import { db as mappingDB } from "@/common/infrastructure/database/index.js"
import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import {
  getMapActivityIds,
  getMapBatchIds,
  getMapEntityIds,
  getMapOrderIds,
  getMapStockIds,
  getMapTransactionReasonIds,
  insertTableMapping,
} from "../../../helper.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

/**
 * 3.0 transaction_type_id = 2 order_id is null
 * 5.0 transaction_type_id = 10 order_id is null
 * @param trx
 * @param migrationDB
 * @param programId
 * @param trxIds
 * @returns
 */
export const migrateTransactions = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  trxIds: number[]
) => {
  const transactions = await migrationDB
    .selectFrom("transactions as tr")
    .leftJoin("stocks as st", "st.id", "tr.stock_id")
    .leftJoin("batches as b", "b.id", "st.batch_id")
    .leftJoin("materials as m", "m.id", "tr.material_id")
    .leftJoin("master_materials as mm", "mm.id", "tr.master_material_id")
    .selectAll("tr")
    .select([
      "b.id as batch_id",
      "st.activity_id as stock_activity_id",
      "m.pieces_per_unit as m_pieces_per_unit",
      "mm.is_openvial as mm_is_openvial",
    ])
    .where("tr.id", "in", trxIds)
    .orderBy(["tr.createdAt", "tr.id"])
    .execute()

  const entityIds = collect(
    transactions,
    "entity_id",
    "customer_id",
    "vendor_id"
  )

  // Get unique stock_activity_ids and map them to program_ids
  const stockActivityIds = collect(transactions, "stock_activity_id").filter(
    (id) => id != null
  )
  const activityToProgramMap =
    stockActivityIds.length > 0
      ? await mappingDB
          .selectFrom("mapping_activities as ma")
          .select(["ma.existing_activity_id", "ma.program_id"])
          .where("ma.existing_activity_id", "in", stockActivityIds)
          .execute()
          .then((rows) =>
            rows.reduce(
              (acc, row) => {
                acc[row.existing_activity_id] = row.program_id
                return acc
              },
              {} as Record<number, number>
            )
          )
      : {}

  // Group stock_ids by their corresponding program_id
  const stockIdsByProgramId = transactions.reduce(
    (acc, trx) => {
      const targetProgramId = trx.stock_activity_id
        ? activityToProgramMap[trx.stock_activity_id]
        : programId
      if (targetProgramId && trx.stock_id) {
        acc[targetProgramId] ??= []
        acc[targetProgramId].push(trx.stock_id)
      }
      return acc
    },
    {} as Record<number, number[]>
  )

  // Get mappings for each program_id
  const stockMappingPromises = Object.entries(stockIdsByProgramId).map(
    ([progId, stockIds]) => getMapStockIds(Number(progId), stockIds)
  )

  const [
    mapEntityIds,
    mapActivityIds,
    mapOrderIds,
    mapBatchIds,
    mapTransactionReasonIds,
  ] = await Promise.all([
    getMapEntityIds(programId, entityIds),
    getMapActivityIds(programId, collect(transactions, "activity_id")),
    getMapOrderIds(programId, collect(transactions, "order_id")),
    getMapBatchIds(programId, collect(transactions, "batch_id")),
    getMapTransactionReasonIds(
      programId,
      collect(transactions, "transaction_reason_id")
    ),
  ])

  // Get stock mappings separately and merge them
  const stockMappings = await Promise.all(stockMappingPromises)
  const mapStockIds = stockMappings.reduce(
    (acc, mapping) => ({ ...acc, ...mapping }),
    {}
  )

  // Get batch codes from mapped batch IDs
  const mappedBatchIds = Object.values(mapBatchIds).filter((id) => id > 0)
  const batchCodes =
    mappedBatchIds.length > 0
      ? await trx
          .selectFrom("ws_batches")
          .select(["id", "code"])
          .where("id", "in", mappedBatchIds)
          .execute()
          .then((rows) =>
            rows.reduce(
              (acc, row) => ({ ...acc, [row.id]: row.code }),
              {} as Record<number, string>
            )
          )
      : {}

  const transactionValues = transactions.map((transaction) => {
    // Determine transaction_type_id based on migration rules
    let transactionTypeId = transaction.transaction_type_id
    if (
      transaction.transaction_type_id === 2 &&
      transaction.order_id === null
    ) {
      transactionTypeId = 10
    }

    return {
      activity_id: mapActivityIds[transaction.activity_id ?? 0],
      opening_qty: transaction.opening_qty,
      change_qty: transaction.change_qty,
      change_qty_open_vial: transaction.open_vial ?? 0,
      opening_qty_open_vial: Math.abs(transaction.open_vial ?? 0),
      qty_in_vial:
        (transaction.mm_is_openvial
          ? (transaction.m_pieces_per_unit ?? 0)
          : 0) ?? 0,
      transaction_type_id: determineTransactionType(
        transactionTypeId,
        transaction.order_id
      ),
      transaction_reason_id:
        mapTransactionReasonIds[transaction.transaction_reason_id ?? 0],
      entity_id: mapEntityIds[transaction.entity_id],
      stock_id: mapStockIds[transaction.stock_id],
      order_id: mapOrderIds[transaction.order_id ?? 0],
      device_type: transaction.device_type,
      batch_code:
        batchCodes[mapBatchIds[transaction.batch_id ?? 0] ?? ""] || null,
      companion_entity_id:
        mapEntityIds[determineCompanionEntityId(transaction) ?? 0],
      // commit_datetime: transaction. // unknown in transactions old table
      actual_transaction_date: transaction.actual_transaction_date,
      created_by: transaction.created_by,
      updated_by: transaction.updated_by,
      created_at: transaction.createdAt! ?? null,
      updated_at: transaction.updatedAt! ?? null,
    }
  })

  const res = await trx
    .insertInto("ws_transactions")
    .values(transactionValues)
    .executeTakeFirst()

  // Note: entity_activity_id will be updated separately using the update-entity-activity-id migration
  // This improves performance by avoiding subqueries during the main transaction migration
  const insertedIds = Array.from(
    { length: transactions.length },
    (_, i) => Number(res.insertId) + i
  )

  const mapGlobalIds = {}
  for (const [i, trx] of transactions.entries()) {
    mapGlobalIds[trx.id] = insertedIds[i]
  }
  await insertTableMapping("transactions", programId, mapGlobalIds)

  return mapGlobalIds
}

const determineCompanionEntityId = (trx: {
  transaction_type_id: number | null
  customer_id: number | null
  vendor_id: number | null
}) => {
  // consumption or return health facility
  if (trx.transaction_type_id === 2 || trx.transaction_type_id === 5) {
    return trx.customer_id
  }

  // penerimaan
  if (trx.transaction_type_id === 3) {
    return trx.vendor_id
  }

  return null
}

const determineTransactionType = (trxType: number, orderId: number | null) => {
  // trx type konsumsi
  if (!orderId && trxType === 2) {
    return 10
  }

  // trx type pembuangan
  if (trxType === 11) {
    return 9
  }

  return trxType
}
