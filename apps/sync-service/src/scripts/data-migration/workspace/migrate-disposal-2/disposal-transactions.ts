import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction, sql } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import {
  deleteTableMapping,
  getMapActivityIds,
  getMapDisposalStockIds,
  getMapEntityIds,
  getMapMaterialIds,
  getMapUserIds,
  insertTableMapping,
  resetIncrement,
} from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

import {
  MAP_EXISTING_ACTIVITY_IDS,
  MAP_EXISTING_TO_PLATFORM,
} from "../../const.js"
import { IMMUNIZATION } from "../../constants/program.js"

const formatDuration = (startTime: Date, endTime: Date): string => {
  const durationMs = endTime.getTime() - startTime.getTime()
  const hours = Math.floor(durationMs / (1000 * 60 * 60))
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
}

const mappingTransactionTypes = {
  2: 1,
  3: 2,
  4: 1,
}

export const migrateDisposalTransactions = async (
  batchSize: number,
  existingProgramId = 1,
  truncate = false
) => {
  const startTime = new Date()
  console.log(
    `Migration disposal transaction started at: ${startTime.toLocaleString()}`
  )

  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[existingProgramId] ?? []

  if (truncate && existingProgramId === IMMUNIZATION) {
    console.log("Truncating immunization disposal transaction tables...")
    await deleteDisposalTransactionRelations(existingProgramId)
  }

  const migrationDB = getMigrationDB(existingProgramId)

  for (const platformProgramId of platformProgramIds) {
    console.log(
      `Migrating disposal transaction for existing program ID ${existingProgramId} to platform program ID ${platformProgramId}`
    )

    const activityIds = MAP_EXISTING_ACTIVITY_IDS[platformProgramId]
    if (activityIds?.length === 0) {
      continue
    }

    let page = 0
    while (true) {
      const rows = await migrationDB
        .selectFrom("extermination_transactions")
        .select(["id"])
        .where("activity_id", "in", activityIds ?? [-1])
        .orderBy("id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      const ids = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        await doMigrate(
          trx,
          migrationDB,
          existingProgramId,
          platformProgramId,
          ids
        )
      })

      page++
      console.log(`Processed batch ${page} with ${rows.length} records`)
    }
  }

  const endTime = new Date()
  console.log(`Migration eventReport completed at: ${endTime.toLocaleString()}`)
  console.log(`Total duration: ${formatDuration(startTime, endTime)}`)
  process.exit(0)
}

async function doMigrate(
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  existingProgramId: number,
  platformProgramId: number,
  ids: number[]
) {
  //get all data in joined query
  const transactions = await migrationDB
    .selectFrom("extermination_transactions as e")
    .innerJoin("orders as o", "o.id", "e.order_id")
    .select([
      "e.id",
      "e.extermination_transaction_type_id as type_id", //converted
      "e.flow_id",
      "e.master_material_id as material_id", //converted
      "e.activity_id", //converted
      "e.entity_id", //converted
      "e.stock_extermination_id", //converted

      "e.opening_qty",
      "e.change_qty",
      "e.createdAt",
      "e.updatedAt",
      "e.created_by",
      "e.updated_by",
      "o.no_document",
    ])
    .where("e.id", "in", ids)
    .execute()

  if (transactions.length === 0) {
    throw new Error("disposal stocks empty")
  }

  const [
    mapActivityIds,
    mapEntityIds,
    mapCreatedByIds,
    mapUpdatedByIds,
    mapMaterialIds,
    mapStockDisposalIds,
  ] = await Promise.all([
    getMapActivityIds(platformProgramId, collect(transactions, "activity_id")),
    getMapEntityIds(platformProgramId, collect(transactions, "entity_id")),
    getMapUserIds(platformProgramId, collect(transactions, "created_by")),
    getMapUserIds(platformProgramId, collect(transactions, "updated_by")),
    getMapMaterialIds(platformProgramId, collect(transactions, "material_id")),
    getMapDisposalStockIds(
      platformProgramId,
      collect(transactions, "stock_extermination_id")
    ),
  ])

  const disposalMap = new Map()
  const result = await trx
    .insertInto("ws_disposal_transactions")
    .values(
      transactions.map((item) => {
        const v = {
          disposal_transaction_type_id:
            mappingTransactionTypes[item.type_id] ?? 0,
          disposal_method_id: item.flow_id ?? 0,
          activity_id: mapActivityIds[item.activity_id ?? 0] ?? 0,
          material_id: mapMaterialIds[item.material_id ?? 0] ?? 0,
          stock_disposal_id:
            mapStockDisposalIds[item.stock_extermination_id ?? 0] ?? 0,
          opening_qty: item.opening_qty ?? 0,
          change_qty: item.change_qty ?? 0,
          disposal_discard_qty: 0,
          disposal_received_qty: 0,
          open_vial: 0,
          created_by: mapCreatedByIds[item.created_by ?? 0] ?? 0,
          updated_by: mapUpdatedByIds[item.updated_by ?? 0] ?? 0,
          created_at: item.createdAt,
          updated_at: item.updatedAt,
          entity_id: mapEntityIds[item.entity_id ?? 0] ?? 0,
          report_number: item.no_document,
          comment: "",
        }
        disposalMap.set(item.id, v)

        return v
      })
    )
    .executeTakeFirst()

  const transactionNewIds = Array.from(
    { length: transactions.length },
    (_, i) => Number(result.insertId) + i
  )

  const mapGlobalIds = {}

  let index = 0
  for (const [oldId] of disposalMap) {
    mapGlobalIds[oldId] = transactionNewIds[index]
    index++
  }

  await insertTableMapping(
    "extermination_transactions",
    platformProgramId,
    mapGlobalIds
  )
}

export const deleteDisposalTransactionRelations = async (
  programId = IMMUNIZATION
) => {
  const platformProgramIds = MAP_EXISTING_TO_PLATFORM[programId] ?? []
  const idsSql = sql.join(
    platformProgramIds.map((id) => sql`${id}`),
    sql`, `
  )

  await sql`
    DELETE dt
    FROM ws_activities a
    LEFT JOIN ws_disposal_transactions dt ON dt.activity_id = a.id
    WHERE a.program_id IN (${idsSql})
  `.execute(db)

  // Reset auto increment for deleted tables
  await resetIncrement(db, "ws_disposal_transactions")
  await deleteTableMapping("extermination_transactions", platformProgramIds)
}
