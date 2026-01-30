import { collect } from "@smile-health/lib/utils.js"
import { Kysely, sql, Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import {
  deleteTableMapping,
  getMapActivityIds,
  getMapEntityIds,
  getMapMaterialIds,
  getMapUserIds,
  insertTableMapping,
  resetIncrement,
} from "../../helper.js"
import { MigrationDB } from "../../types.js"
import { DB } from "../../types.platform.js"
import {
  MAP_EXISTING_ACTIVITY_IDS,
  MAP_EXISTING_TO_PLATFORM,
} from "../const.js"
import { IMMUNIZATION } from "../constants/program.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

export const migrateReconciliations = async (
  batchSize: number,
  existingProgramId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.log(
    `Migration reconciliations started at: ${startTime.toLocaleString()}`
  )
  console.info("Reconciliation migration starting...")

  if (truncate && existingProgramId === IMMUNIZATION) {
    console.log("Truncating immunization reconciliation tables...")
    await deleteReconciliationRelations(existingProgramId)
  }

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[existingProgramId] ?? []
  for (const platformProgramId of platformProgramIds) {
    console.log(
      `Migrating reconciliations for existing program ID ${existingProgramId} to platform program ID ${platformProgramId}`
    )

    const migrationDB = getMigrationDB(existingProgramId)
    let page = 0
    while (true) {
      const rows = await migrationDB
        .selectFrom("reconciliation as r")
        .select(["r.id"])
        .where("r.deleted_at", "is", null)
        .orderBy("r.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const reconciliationIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        await doMigrateReconciliations(
          trx,
          migrationDB,
          existingProgramId,
          platformProgramId,
          reconciliationIds
        )
      })

      page++
      console.log(`Processed batch ${page} with ${rows.length} records`)
    }
  }

  const endTime = new Date()
  console.log(
    `Migration reconciliations completed at: ${endTime.toLocaleString()}`
  )
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  console.log("Reconciliation migration completed")
  process.exit(0)
}

export const deleteReconciliationRelations = async (
  programId = IMMUNIZATION
) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = sql.join(
    platformProgramIds.map((id) => sql`${id}`),
    sql`, `
  )
  await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(db)
  await sql`
    DELETE r, ri, rira
    FROM ws_activities a
    LEFT JOIN ws_reconciliations r ON r.activity_id = a.id
    LEFT JOIN ws_reconciliation_items ri ON ri.reconciliation_id = r.id
    LEFT JOIN ws_reconciliation_item_reason_actions rira ON rira.reconciliation_item_id = ri.id
    WHERE a.program_id IN (${idsSql})
  `.execute(db)
  await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(db)

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_reconciliations")
  await resetIncrement(db, "ws_reconciliation_items")
  await resetIncrement(db, "ws_reconciliation_item_reason_actions")
  await deleteTableMapping("reconciliations", platformProgramIds)
}

export const doMigrateReconciliations = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  existingProgramId: number,
  platformProgramId: number,
  reconciliationIds: number[]
) => {
  const activityIds = MAP_EXISTING_ACTIVITY_IDS[platformProgramId]
  if (activityIds?.length === 0) {
    return
  }

  // Get all data in one joined query
  const reconciliationData = await migrationDB
    .selectFrom("reconciliation as r")
    .leftJoin("reconciliation_items as ri", "ri.reconciliation_id", "r.id")
    .leftJoin(
      "reconciliation_item_reason_actions as rira",
      "rira.reconciliation_item_id",
      "ri.id"
    )
    .select([
      "r.id as reconciliation_id",
      "r.entity_id",
      "r.activity_id",
      "r.start_date",
      "r.end_date",
      "r.master_material_id",
      "r.created_at",
      "r.updated_at",
      "r.created_by",
      "ri.id as item_id",
      "ri.real_qty",
      "ri.smile_qty",
      "ri.stock_category",
      "rira.id as reason_action_id",
      "rira.reason_id",
      "rira.action_id",
    ])
    .where("r.id", "in", reconciliationIds)
    .where("r.activity_id", "in", activityIds ?? [-1])
    .execute()

  if (reconciliationData.length === 0) return

  const [mapEntityIds, mapActivityIds, mapMaterialIds, mapUserIds] =
    await Promise.all([
      getMapEntityIds(
        platformProgramId,
        collect(reconciliationData, "entity_id")
      ),
      getMapActivityIds(
        platformProgramId,
        collect(reconciliationData, "activity_id")
      ),
      getMapMaterialIds(
        platformProgramId,
        collect(reconciliationData, "master_material_id")
      ),
      getMapUserIds(
        platformProgramId,
        collect(reconciliationData, "created_by")
      ),
    ])

  // Collect unique reconciliations, items, and reason actions
  const uniqueReconciliations = new Map()
  const uniqueReconciliationItems = new Map()
  const uniqueReconciliationItemReasonActions = new Map()

  reconciliationData.forEach((data) => {
    if (data.reconciliation_id) {
      uniqueReconciliations.set(data.reconciliation_id, {
        entity_id: mapEntityIds[data.entity_id] ?? 0,
        activity_id: mapActivityIds[data.activity_id ?? 0] ?? 0,
        start_date: data.start_date,
        end_date: data.end_date,
        material_id: mapMaterialIds[data.master_material_id ?? 0] ?? 0,
        program_id: platformProgramId,
        created_at: data.created_at ?? new Date(),
        updated_at: data.updated_at ?? new Date(),
        created_by: mapUserIds[data.created_by ?? 0] ?? 0,
      })
    }

    if (data.item_id) {
      uniqueReconciliationItems.set(data.item_id, {
        reconciliation_id: data.reconciliation_id,
        actual_qty: data.real_qty ?? 0,
        recorded_qty: data.smile_qty ?? 0,
        reconciliation_category_id: data.stock_category ?? 0,
        created_at: data.created_at ?? new Date(),
        updated_at: data.updated_at ?? new Date(),
        created_by: mapUserIds[data.created_by ?? 0] ?? 0,
      })
    }

    if (data.reason_action_id) {
      uniqueReconciliationItemReasonActions.set(data.reason_action_id, {
        reconciliation_item_id: data.item_id,
        reason_id: data.reason_id,
        action_id: data.action_id,
        created_at: data.created_at ?? new Date(),
        updated_at: data.updated_at ?? new Date(),
      })
    }
  })

  // Bulk insert ws_reconciliations
  const newReconciliationIdsMap = new Map<number, number>()

  if (uniqueReconciliations.size > 0) {
    const res = await trx
      .insertInto("ws_reconciliations")
      .values(Array.from(uniqueReconciliations.values()))
      .executeTakeFirst()

    const reconciliationIds = Array.from(
      { length: uniqueReconciliations.size },
      (_, i) => Number(res.insertId) + i
    )

    // Kysely's execute() for bulk inserts returns an array of InsertResult.
    // Each InsertResult contains the insertId for its corresponding row.
    Array.from(uniqueReconciliations.keys()).forEach((oldId, index) => {
      const newId = reconciliationIds[index]
      if (newId !== undefined) {
        newReconciliationIdsMap.set(oldId, Number(newId))
      }
    })
  }

  // Bulk insert ws_reconciliation_items
  const newReconciliationItemIdsMap = new Map<number, number>()
  if (uniqueReconciliationItems.size > 0) {
    const itemsToInsert = Array.from(uniqueReconciliationItems.values()).map(
      (item) => ({
        ...item,
        reconciliation_id: newReconciliationIdsMap.get(item.reconciliation_id)!, // Map to new reconciliation_id
      })
    )

    const res = await trx
      .insertInto("ws_reconciliation_items")
      .values(itemsToInsert)
      .executeTakeFirst()

    const itemIds = Array.from(
      { length: itemsToInsert.length },
      (_, i) => Number(res.insertId) + i
    )

    Array.from(uniqueReconciliationItems.keys()).forEach((oldId, index) => {
      const newId = itemIds[index]
      if (newId !== undefined) {
        newReconciliationItemIdsMap.set(oldId, Number(newId))
      }
    })
  }

  // Bulk insert ws_reconciliation_item_reason_actions
  if (uniqueReconciliationItemReasonActions.size > 0) {
    const reasonActionsToInsert = Array.from(
      uniqueReconciliationItemReasonActions.values()
    ).map((action) => ({
      ...action,
      reconciliation_item_id: newReconciliationItemIdsMap.get(
        action.reconciliation_item_id
      )!, // Map to new reconciliation_item_id
    }))

    await trx
      .insertInto("ws_reconciliation_item_reason_actions")
      .values(reasonActionsToInsert)
      .execute()
  }

  //  Insert into mapping_reconciliations
  if (newReconciliationIdsMap.size > 0) {
    console.log(
      `Inserting ${newReconciliationIdsMap.size} reconciliation mappings for program ${platformProgramId}`
    )
    const reconciliationMappings = Object.fromEntries(newReconciliationIdsMap)
    const mappingRes = await insertTableMapping(
      "reconciliations",
      platformProgramId,
      reconciliationMappings
    )
    if (mappingRes)
      console.log(
        `Finished inserting ${newReconciliationIdsMap.size} reconciliation mappings for program ${platformProgramId}`
      )
    else
      console.log(
        `Failed inserting reconciliation mappings for program ${platformProgramId}`
      )
  }
}
