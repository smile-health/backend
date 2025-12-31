import { logger } from "@smile/lib/logger.js"
import { Kysely } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import { MigrationDB } from "../../../types.js"
import {
  getMapEntityIds,
  getMapMaterialIds,
  getMapBatchIds,
  getMapStockIds,
  getMapActivityIds,
  getMapTransactionIds,
  getMapUserIds,
} from "../../../helper.js"

export const migrateAyoSehat = async (
  batchSize: number,
  programId: number
) => {
  const migrationDB = getMigrationDB(programId)
  let offset = 0
  let totalProcessed = 0

  logger.info(`Starting Ayo Sehat migration for program ${programId}`)

  while (true) {
    const result = await doMigrateAyoSehat(
      migrationDB,
      programId,
      batchSize,
      offset
    )

    if (result === 0) {
      break
    }

    totalProcessed += result
    offset += batchSize

    logger.info(
      `Processed ${result} Ayo Sehat records (total: ${totalProcessed})`
    )
  }

  logger.info(
    `Ayo Sehat migration completed. Total processed: ${totalProcessed}`
  )

  return { count: totalProcessed }
}

const doMigrateAyoSehat = async (
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  batchSize: number,
  offset: number
) => {
  // Fetch data from source database
  const rows = await migrationDB
    .selectFrom("integration_ayo_sehat as ays")
    .selectAll("ays")
    .orderBy("ays.id")
    .limit(batchSize)
    .offset(offset)
    .execute()

  if (rows.length === 0) {
    return 0
  }

  // Extract IDs for mapping
  const vendorIds = [...new Set(rows.map(row => row.vendor_id).filter(Boolean))]
  const customerIds = [...new Set(rows.map(row => row.customer_id).filter(Boolean))]
  const activityIds = [...new Set(rows.map(row => row.activity_id).filter(Boolean))]
  const materialIds = [...new Set(rows.map(row => row.master_material_id).filter(Boolean))]
  const stockIds = [...new Set(rows.map(row => row.stock_id).filter(Boolean))]
  const batchIds = [...new Set(rows.map(row => row.batch_id).filter(Boolean))]
  const transactionConsumedIds = [...new Set(rows.map(row => row.transaction_id_consumed).filter(Boolean))]
  const transactionReturnIds = [...new Set(rows.map(row => row.transaction_id_return).filter(Boolean))]
  const transactionInjectionIds = [...new Set(rows.map(row => row.transaction_id_injection).filter(Boolean))]
  const createdByIds = [...new Set(rows.map(row => row.created_by).filter(Boolean))]

  // Get ID mappings
  const [vendorMap, customerMap, activityMap, materialMap, stockMap, batchMap, 
         transactionConsumedMap, transactionReturnMap, transactionInjectionMap, userMap] = await Promise.all([
    getMapEntityIds(programId, vendorIds),
    getMapEntityIds(programId, customerIds),
    getMapActivityIds(programId, activityIds),
    getMapMaterialIds(programId, materialIds),
    getMapStockIds(programId, stockIds),
    getMapBatchIds(programId, batchIds),
    getMapTransactionIds(programId, transactionConsumedIds),
    getMapTransactionIds(programId, transactionReturnIds),
    getMapTransactionIds(programId, transactionInjectionIds),
    getMapUserIds(programId, createdByIds),
  ])

  // Transform data for insertion
  const transformedRows = rows.map(row => ({
    vendor_id: vendorMap[row.vendor_id] || null,
    customer_id: customerMap[row.customer_id] || null,
    activity_id: activityMap[row.activity_id] || null,
    material_id: materialMap[row.material_id] || null,
    stock_id: stockMap[row.stock_id] || null,
    batch_id: batchMap[row.batch_id] || null,
    status_vvm: row.status_vvm,
    consumed_qty: row.consumed_qty,
    consumed_qty_openvial: row.consumed_qty_openvial,
    consumed_qty_closevial: row.consumed_qty_closevial,
    transaction_id_consumed: transactionConsumedMap[row.transaction_id_consumed] || null,
    created_at_consumed_smile: row.created_at_consumed_smile,
    consumed_status: row.consumed_status,
    session_id: row.session_id,
    transaction_id_return: transactionReturnMap[row.transaction_id_return] || null,
    return_qty: row.return_qty,
    return_qty_openvial: row.return_qty_openvial,
    return_qty_closevial: row.return_qty_closevial,
    transaction_id_injection: transactionInjectionMap[row.transaction_id_injection] || null,
    injection_qty: row.injection_qty,
    created_at_injection: row.created_at_injection,
    created_at_return_vaccination: row.created_at_return_vaccination,
    updated_at_return_vaccination: row.updated_at_return_vaccination,
    return_status: row.return_status,
    return_validation: row.return_validation,
    created_by: userMap[row.created_by] || null,
    integration_status: false,
    created_at: new Date(),
    updated_at: new Date(),
  }))

  // Insert into target database with duplicate key handling
  await db
    .insertInto("integration_ayo_sehat")
    .values(transformedRows)
    .onDuplicateKeyUpdate({
      vendor_id: (eb) => eb.ref("vendor_id"),
      customer_id: (eb) => eb.ref("customer_id"),
      activity_id: (eb) => eb.ref("activity_id"),
      material_id: (eb) => eb.ref("material_id"),
      stock_id: (eb) => eb.ref("stock_id"),
      batch_id: (eb) => eb.ref("batch_id"),
      status_vvm: (eb) => eb.ref("status_vvm"),
      consumed_qty: (eb) => eb.ref("consumed_qty"),
      consumed_qty_openvial: (eb) => eb.ref("consumed_qty_openvial"),
      consumed_qty_closevial: (eb) => eb.ref("consumed_qty_closevial"),
      transaction_id_consumed: (eb) => eb.ref("transaction_id_consumed"),
      created_at_consumed_smile: (eb) => eb.ref("created_at_consumed_smile"),
      consumed_status: (eb) => eb.ref("consumed_status"),
      session_id: (eb) => eb.ref("session_id"),
      transaction_id_return: (eb) => eb.ref("transaction_id_return"),
      return_qty: (eb) => eb.ref("return_qty"),
      return_qty_openvial: (eb) => eb.ref("return_qty_openvial"),
      return_qty_closevial: (eb) => eb.ref("return_qty_closevial"),
      transaction_id_injection: (eb) => eb.ref("transaction_id_injection"),
      injection_qty: (eb) => eb.ref("injection_qty"),
      created_at_injection: (eb) => eb.ref("created_at_injection"),
      created_at_return_vaccination: (eb) => eb.ref("created_at_return_vaccination"),
      updated_at_return_vaccination: (eb) => eb.ref("updated_at_return_vaccination"),
      return_status: (eb) => eb.ref("return_status"),
      return_validation: (eb) => eb.ref("return_validation"),
      created_by: (eb) => eb.ref("created_by"),
      integration_status: (eb) => eb.ref("integration_status"),
      updated_at: new Date(),
    })
    .execute()

  return rows.length
}