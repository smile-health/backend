/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/scripts/db.platform.js"
import {
  deleteTableMapping,
  deleteTableMaster,
  getMapGlobalUserIds,
  getMapUserIds,
  insertTableMapping,
  partition,
} from "@/scripts/helper.js"
import { DB } from "@/scripts/types.platform.js"
import { collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { MigrationDB } from "../../types.js"
import { MAP_EXISTING_TO_PLATFORM } from "../const.js"
import { IMMUNIZATION } from "../constants/program.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateEntities = async (
  batchSize = 10000,
  programId = 1,
  truncate: boolean = false
) => {
  const startTime = new Date()
  console.info(`Migration entities started at: ${startTime.toLocaleString()}`)
  console.info("migration start...")

  // Truncate tables if requested
  if (truncate && programId === IMMUNIZATION) {
    console.log("Deleting previous Immunization data...")

    const programIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
    await deleteTableMaster("entities", programIds)
    await deleteTableMapping("entities", programIds)
  }

  const migrationDB = getMigrationDB(programId)

  let entityCount = 0
  let entityWorkspaceCount = 0
  let page = 0
  try {
    while (true) {
      const rows = await migrationDB
        .selectFrom("entities as e")
        .select(["e.id"])
        .orderBy("e.id")
        .where("deleted_at", "is", null)
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const entityIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const counts = await doMigrateEntities(
          migrationDB,
          trx,
          entityIds,
          programId
        )
        entityCount += counts.entityCount
        entityWorkspaceCount += counts.entityWorkspaceCount
      })

      page++
      console.log(`batch ${page} is finished`)
    }

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration entities finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Entities: ${entityCount} records`)
    console.info(`   - Entity Workspaces: ${entityWorkspaceCount} records`)
    console.info("✅ All global entity migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("migration failed")
    console.error(error)
    process.exit(1)
  }
}

const isEntityTagIs14 = (lowerCaseName: string): boolean => {
  const entitas14Prefixes = ["tk", "sd", "sdn", "smp"]
  for (const prefix of entitas14Prefixes) {
    if (lowerCaseName.startsWith(prefix + " ")) {
      return true
    }
  }
  return false
}

const getEntityTagId = (
  entityName: string | null,
  entityTagID: number | null
): number => {
  const lowerCaseName = entityName?.toLowerCase().trim() ?? ""
  let tagId: number = Number(entityTagID ?? 0)

  if (!tagId && isEntityTagIs14(lowerCaseName)) {
    tagId = 14
  } else if (!tagId && lowerCaseName.includes("dalam gedung")) {
    tagId = 10
  } else if (!tagId) {
    tagId = 18 // Default to 18 for other cases
  }
  return tagId
}

const getEntityType = (type?: number | null): number => {
  // Default to 5 if type is not provided or is one of the specified types
  if (!type || ![1, 2, 3, 4].includes(type)) {
    return 5
  }
  return type
}

export const doMigrateEntities = async (
  migrationDB: Kysely<MigrationDB>,
  trx: Transaction<DB>,
  entityIds: number[],
  programId: number
) => {
  // In doMigrateEntities function, add better filtering
  const rows = await migrationDB
    .selectFrom("entities as e")
    .leftJoin("mapping_entities as me", "me.id_entitas_smile", "e.id")
    .leftJoin("entity_entity_tags as eet", "eet.entity_id", "e.id")
    .selectAll()
    .select(["e.id as id"])
    .where("e.id", "in", entityIds)
    .where("e.deleted_at", "is", null) // Ensure we only migrate non-deleted entities
    .groupBy("e.id")
    .execute()

  const entityCodes = collect(rows, "code")
  const entityIdSatuSehat = collect(rows, "id_satu_sehat")

  const existingCretedByIds = collect(rows, "created_by")
  const existingUpdatedByIds = collect(rows, "updated_by")

  const [mappedPlatformCreatedByGlobalIds, mappedPlatformUpdatedByGlobalIds] =
    await Promise.all([
      getMapGlobalUserIds(existingCretedByIds),
      getMapGlobalUserIds(existingUpdatedByIds),
    ])

  const platformEntities = await db
    .selectFrom("entities as e")
    .select(["e.id", "e.code", "e.id_satu_sehat"])
    .where((eb) =>
      eb.or([
        eb("e.code", "in", entityCodes.length > 0 ? entityCodes : [-1]),
        eb(
          "e.id_satu_sehat",
          "in",
          entityIdSatuSehat.length > 0 ? entityIdSatuSehat : [-1]
        ),
      ])
    )
    .execute()

  // separate existing and new entities
  const [existingEntities, entities] = partition(rows, (row) =>
    platformEntities.some(
      (e) =>
        (row.code && e.code === row.code) ||
        (row.id_satu_sehat && e.id_satu_sehat === row.id_satu_sehat?.toString())
    )
  )
  const wsRows: any = []
  const mapLegacyIds = {}

  if (entities.length > 0) {
    const res = await trx
      .insertInto("entities")
      .values(
        entities.map((entity) => ({
          id_satu_sehat: entity.id_satu_sehat,
          code: entity.code,
          type: getEntityType(entity.type),
          status: entity.status ?? 0,
          name: entity.name,
          entity_tag_id: getEntityTagId(entity.name, entity.entity_tag_id),
          address: entity.address,
          country: entity.country ?? "ID",
          province_id: entity.province_id,
          regency_id: entity.regency_id,
          sub_district_id: entity.sub_district_id,
          village_id: entity.village_id,
          postal_code: entity.postal_code,
          lat: entity.lat,
          lng: entity.lng,
          is_puskesmas: entity.is_puskesmas ?? 0,
          is_vendor: entity.is_vendor,
          created_at: entity.created_at ?? new Date(),
          updated_at: entity.updated_at ?? new Date(),
          created_by: mappedPlatformCreatedByGlobalIds[entity.created_by ?? 0],
          updated_by: mappedPlatformUpdatedByGlobalIds[entity.updated_by ?? 0],
        }))
      )
      .executeTakeFirst()

    const insertedIds = Array.from(
      { length: entities.length },
      (_, i) => Number(res.insertId) + i
    )

    for (const [i, entity] of entities.entries()) {
      wsRows.push({
        entity_id: insertedIds[i],
        is_vendor: Number(entity.is_vendor),
        is_relocation: entity.is_vendor ? 1 : 0,
        created_by: entity.created_by,
        updated_by: entity.updated_by,
      })
      mapLegacyIds[insertedIds[i]] = entity.id
    }
  }

  // insert existing entities
  for (const entity of existingEntities) {
    const platformEntity = platformEntities.find(
      (e) =>
        (entity.code && e.code === entity.code) ||
        (entity.id_satu_sehat &&
          e.id_satu_sehat === entity.id_satu_sehat?.toString())
    )
    wsRows.push({
      entity_id: platformEntity?.id,
      is_vendor: Number(entity.is_vendor),
      is_relocation: entity.is_vendor ? 1 : 0,
      created_by: entity.created_by,
      updated_by: entity.updated_by,
    })
    mapLegacyIds[platformEntity?.id] = entity.id
  }

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

  for (const progId of platformProgramIds) {
    const collectedCreatedBy = collect(wsRows, "created_by")
    const collectedUpdatedBy = collect(wsRows, "updated_by")

    const [mappedPlatformCreatedByIds, mappedPlatformUpdateByIds] =
      await Promise.all([
        getMapUserIds(progId, collectedCreatedBy),
        getMapUserIds(progId, collectedUpdatedBy),
      ])

    // insert entity workspaces
    const wsRes = await trx
      .insertInto("entity_workspaces")
      .values(
        wsRows.map((wsRow) => ({
          ...wsRow,
          workspace_id: progId,
          created_by: mappedPlatformCreatedByIds[wsRow.created_by],
          updated_by: mappedPlatformUpdateByIds[wsRow.updated_by],
        }))
      )
      .executeTakeFirst()
    const wsInsertedIds = Array.from(
      { length: wsRows.length },
      (_, i) => Number(wsRes.insertId) + i
    )

    // update ws global id
    const mapGlobalIds = {}
    const mapPlatformGlobalIds = {}
    for (const [i, wsRow] of wsRows.entries()) {
      mapGlobalIds[mapLegacyIds[wsRow.entity_id]] = wsInsertedIds[i]
      mapPlatformGlobalIds[mapLegacyIds[wsRow.entity_id]] = wsRow.entity_id
    }

    await insertTableMapping(
      "entities",
      progId,
      mapGlobalIds,
      mapPlatformGlobalIds
    )
  }

  return {
    entityCount: wsRows.length,
    entityWorkspaceCount: wsRows.length * platformProgramIds.length,
  }
}
