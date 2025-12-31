import { Context } from "hono"
import { StockBookQueryParams } from "./stock-book.schema.js"

export class StockBookQuery {
  constructor() {}

  buildStockBookQuery(c: Context, queryParams: StockBookQueryParams) {
    const programId = c.var.programId ?? queryParams.program_id
    const { activity_id, province_id, regency_id, entity_id } = queryParams

    let filters = ""
    filters += province_id
      ? " AND dmt.entities_province_id = {province_id:Int64}"
      : ""
    filters += regency_id
      ? " AND dmt.entities_regency_id = {regency_id:Int64}"
      : ""
    filters += entity_id ? " AND dmt.entities_id = {entity_id:Int64}" : ""
    filters += activity_id
      ? " AND dmt.transactions_activity_id = {activity_id:Int64}"
      : ""

    return `
      SELECT 
        dmt.entities_name as entity_name,
        dmt.customer_name as customer_name,
        dmt.vendor_name as vendor_name,
        dmt.transactions_transaction_type_id as transaction_type_id,
        toInt64(rwtt.change_type) as transaction_change_type_id,
        dmt.transactions_created_at + interval 7 hour as transaction_created_at,
        dmt.transactions_opening_qty as transaction_opening_qty,
        dmt.transactions_change_qty as transaction_change_qty,
        (dmt.transactions_opening_qty + dmt.transactions_change_qty) as transaction_closing_qty,
        dmt.dmm_parent_id as material_id,
        dmt.material_type_id as material_type_id,
        dmt.material_type_name as material_type_name,
        dmt.dmm_unit_of_consumption_name AS material_unit_of_consumption_name,
        dmt.batches_code as batch_code,
        dmt.expired_date as batch_expired_date,
        dmt.transactions_activity_id as transaction_activity_id,
        dmt.transactions_activity_name as transaction_activity_name,
        dmt.stock_activity_id as stock_activity_id,
        dmt.stock_activity_name as stock_activity_name,
        dmt.transactions_transaction_reason_name as transaction_reason_name,
        rwor.content as transaction_other_reason
      FROM datamart_monitoring_transactions_v5 dmt FINAL
      LEFT JOIN raw_ws_other_reasons rwor FINAL ON dmt.transactions_id = rwor.source_id AND rwor.source_type = 'transaction'
      JOIN raw_ws_transaction_types rwtt FINAL ON dmt.transactions_transaction_type_id = rwtt.id
      PREWHERE dmt.program_id = ${programId}
      WHERE
        dmt.transactions_id is not NULL
        AND dmt.master_deleted_at IS NULL
        ${filters}
      ORDER BY dmt.transactions_created_at ASC
    `
  }

  buildEntityMaterialActivityQuery(
    c: Context,
    queryParams: StockBookQueryParams
  ) {
    const programId = c.var.programId ?? queryParams.program_id

    return `
      SELECT DISTINCT
        dwema.ema_material_id as material_id,
        rwm.name as material_name,
        rmt.name as material_type_name
      FROM dim_ws_entity_material_activities as dwema FINAL
      JOIN raw_ws_materials rwm FINAL ON dwema.ema_material_id = rwm.id AND rwm.program_id = ${programId}
      JOIN raw_material_types rmt FINAL ON rwm.material_type_id = rmt.id
      PREWHERE dwema.program_id = ${programId}
      WHERE 
        dwema.ema_entity_id = {entity_id:Int64}
        AND dwema.ema_activity_id = {activity_id:Int64}
    `
  }
}
