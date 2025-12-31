import { collect } from "@smile/lib/utils.js"
import { Kysely, sql, Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import { getMapManufactureIds, getMapMaterialIds, insertTableMapping, resetIncrement } from "../../helper.js"
import { MigrationDB } from "../../types.js"
import { DB } from "../../types.platform.js"
import {
  MAP_EXISTING_ACTIVITY_IDS,
  MAP_EXISTING_TO_PLATFORM,
} from "../const.js"
import { IMMUNIZATION } from "../constants/program.js"
import { db as mappingDB } from "../../../common/infrastructure/database/index.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateBatches = async (programId = 1, truncate = false) => {
  const startTime = new Date()
  console.info(`Migration batches started at: ${startTime.toLocaleString()}`)
  console.info("migration start...")

  if (truncate && programId === IMMUNIZATION) {
    await deleteBatchRelations(programId)
  }

  const migrationDB = getMigrationDB(programId)
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []

  let batchCount = 0
  let batchWorkspaceCount = 0
  try {
    for (const progId of platformProgramIds) {
      console.log("migrating batches", progId)
      await db.transaction().execute(async (trx) => {
        const counts = await doMigrateBatches(trx, migrationDB, progId)
        batchCount += counts.batchCount
        batchWorkspaceCount += counts.batchWorkspaceCount
      })
    }

    const endTime = new Date()
    const duration = formatDuration(startTime, endTime)

    console.info(
      `\n🎉 Migration batches finished at: ${endTime.toLocaleString()}`
    )
    console.info(`📊 Total duration: ${duration}`)
    console.info(`📈 Summary:`)
    console.info(`   - Batches: ${batchCount} records`)
    console.info(
      `   - Batch Workspaces: ${batchWorkspaceCount} records`
    )
    console.info("✅ All workspace batch migration completed successfully")
    process.exit(0)
  } catch (error) {
    console.error("migration failed")
    console.error(error)
    process.exit(1)
  }
}

export const doMigrateBatches = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number
) => {
  const activityIds = MAP_EXISTING_ACTIVITY_IDS[programId]
  if (!activityIds || activityIds.length === 0) {
    return { batchCount: 0, batchWorkspaceCount: 0 }
  }

  const batches = await migrationDB
    .selectFrom("batches as b")
    .innerJoin("stocks as s", "s.batch_id", "b.id")
    .innerJoin("entity_has_master_materials as em", "em.id", "s.entity_has_material_id")
    .select([
      "b.id",
      "b.manufacture_id",
      "b.code",
      "b.production_date",
      "b.expired_date",
      sql<number>`(
        SELECT em2.master_material_id 
        FROM stocks s2 
        INNER JOIN entity_has_master_materials em2 ON em2.id = s2.entity_has_material_id 
        WHERE s2.batch_id = b.id 
        AND s2.activity_id IN (${sql.join(activityIds.map(id => sql`${id}`))})
        LIMIT 1
      )`.as("master_material_id"),
    ])
    .where("s.activity_id", "in", activityIds)
    .groupBy(["b.id", "b.manufacture_id", "b.code", "b.production_date", "b.expired_date"])
    .execute()

  if (batches.length === 0) {
    return { batchCount: 0, batchWorkspaceCount: 0 }
  }

  const mapManufactureIds = await getMapManufactureIds(
    programId,
    collect(batches, "manufacture_id")
  )

  const mapMaterialIds = await getMapMaterialIds(
    programId,
    collect(batches, "master_material_id")
  )

  const wsBatches = await trx
    .insertInto("ws_batches")
    .values(
      batches.map((batch) => ({
        code: batch.code ?? "",
        manufacture_id: mapManufactureIds[batch.manufacture_id ?? 0] ?? 0,
        material_id: mapMaterialIds[batch.master_material_id ?? 0] ?? 0,
        production_date: batch.production_date,
        expired_date: batch.expired_date,
      }))
    )
    .executeTakeFirst()

  const insertedIds = Array.from(
    { length: batches.length },
    (_, i) => Number(wsBatches.insertId) + i
  )
  const mapLegacyIds = {}
  for (const [i, batch] of batches.entries()) {
    mapLegacyIds[batch.id] = insertedIds[i]
  }

  await insertTableMapping("batches", programId, mapLegacyIds)

  return { batchCount: batches.length, batchWorkspaceCount: batches.length }
}

export const deleteBatchRelations = async (programId = IMMUNIZATION) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  
  if (platformProgramIds.length === 0) {
    console.log(`No platform program IDs found for program ${programId}, skipping batch deletion`)
    return
  }
  
  const idsSql = sql.join(
    platformProgramIds.map((id) => sql`${id}`),
    sql`, `
  )

  await sql`
    DELETE wb
    FROM ws_activities a
    LEFT JOIN ws_stocks s ON s.activity_id = a.id
    LEFT JOIN ws_batches wb ON wb.id = s.batch_id
    WHERE a.program_id IN (${idsSql})
  `.execute(db)

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_batches")
  await resetIncrement(mappingDB, "mapping_batches")
}
