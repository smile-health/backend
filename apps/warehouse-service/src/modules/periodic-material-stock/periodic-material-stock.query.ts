import { Context } from "hono"
import { PeriodicMaterialStockQueryParams } from "./periodic-material-stock.schema.js"

export class PeriodicMaterialStockQuery {
  constructor() {}

  buildMaterialQtyQuery(
    c: Context,
    queryParams: PeriodicMaterialStockQueryParams
  ): string {
    const programId = c.var.programId ?? queryParams.program_id
    const { period, activity_ids } = queryParams

    const periodField =
      period === "monthly"
        ? "toMonth(dsav.transactions_created_at + toIntervalHour(7)) AS date"
        : "toYear(dsav.transactions_created_at + toIntervalHour(7)) AS date"

    const activityFilter = activity_ids
      ? " AND dsav.stock_activity_id IN {activity_ids:Array(Int64)}"
      : ""

    const query = `
      WITH {from:DateTime('Asia/Jakarta')} AS date_start_spec,
           {to:DateTime('Asia/Jakarta')} AS date_end_spec,
           {currentDate:DateTime('Asia/Jakarta')} AS current_date_spec
      SELECT
        dsav.entities_id AS entity_id,
        ${periodField},
        dsav.transactions_master_material_id AS material_id,
        argMin(dsav.balance_per_entity_master_materials, dsav.transactions_created_at) AS opening_qty,
        COALESCE(sum(dsav.transactions_change_qty) FILTER (WHERE dsav.transactions_transaction_type_id = 3 AND dsav.transactions_order_id IS NOT NULL AND dsav.orders_order_type_id IN (1, 2, 4, 7) AND dsav.orders_order_status_id = 5), 0)
          + COALESCE(sum(dsav.transactions_change_qty) FILTER (WHERE dsav.transactions_transaction_type_id = 3 AND dsav.transactions_order_id IS NOT NULL AND dsav.orders_order_type_id = 3 AND dsav.orders_order_status_id = 5), 0)
          + COALESCE(sum(dsav.transactions_change_qty) FILTER (WHERE dsav.transactions_transaction_type_id = 3 AND dsav.transactions_order_id IS NOT NULL AND dsav.orders_order_status_id = 6), 0)
        AS received_qty,
        opening_qty + received_qty AS ordered_qty,
        COALESCE(sum(dsav.transactions_change_qty * -1) FILTER (WHERE dsav.transactions_transaction_type_id = 2 AND dsav.transactions_order_id IS NOT NULL AND dsav.orders_order_type_id IN (1, 2, 4, 7) AND dsav.orders_order_status_id IN (4, 5)), 0) AS distribution_qty,
        COALESCE(sum(dsav.transactions_change_qty * -1) FILTER (WHERE dsav.transactions_transaction_type_id IN (10, 5) AND dsav.transactions_order_id IS NULL), 0)
          + COALESCE(sum(dsav.transactions_change_qty * -1) FILTER (WHERE dsav.transactions_transaction_type_id = 2 AND dsav.transactions_order_id IS NOT NULL AND dsav.orders_order_type_id IN (1, 2, 4, 7) AND dsav.orders_order_status_id IN (4, 5)), 0)
          + COALESCE(sum(dsav.transactions_change_qty * -1) FILTER (WHERE dsav.transactions_transaction_type_id = 2 AND dsav.transactions_order_id IS NOT NULL AND dsav.orders_order_type_id = 3 AND dsav.orders_order_status_id IN (4, 5)), 0)
          + COALESCE(sum(dsav.transactions_change_qty * -1) FILTER (WHERE dsav.transactions_transaction_type_id = 2 AND dsav.transactions_order_id IS NOT NULL AND dsav.orders_order_status_id IN (6)), 0)
        AS issues_qty,
        COALESCE(sum(dsav.transactions_change_qty * -1) FILTER (WHERE dsav.transactions_transaction_type_id IN (4, 9)), 0) AS discard_qty,
        COALESCE(sum(dsav.transactions_change_qty) FILTER (WHERE dsav.transactions_transaction_type_id = 7), 0)
          + COALESCE(sum(dsav.transactions_change_qty) FILTER (WHERE dsav.transactions_transaction_type_id = 8), 0)
          + COALESCE(sum(dsav.transactions_change_qty) FILTER (WHERE dsav.transactions_transaction_type_id = 1), 0)
        AS other_qty,
        argMax(dsav.balance_per_entity_master_materials, dsav.transactions_created_at) AS closing_qty,
        '' AS vaccine_ip,
        '' AS scope_total
      FROM datamart_stock_availability_v5 dsav FINAL
      PREWHERE dsav.program_id = ${programId}
      WHERE
        dsav.transactions_created_at BETWEEN date_start_spec AND date_end_spec
        AND dsav.entities_id = {entity_id:Int64}
        ${activityFilter}
        AND (
          (dsav.join_date <= current_date_spec AND dsav.end_date >= current_date_spec)
          OR (dsav.end_date IS NULL AND dsav.join_date <= current_date_spec)
        )
      GROUP BY
        date,
        material_id,
        entity_id
      ORDER BY
        entity_id,
        material_id,
        date ASC
    `

    return query.trim()
  }

  buildLastUpdatedQuery(): string {
    return `
      SELECT 
        formatDateTime(max(dsav.transactions_created_at), '%Y-%m-%d %H:%i:%s') as last_updated
      FROM datamart_stock_availability_v5 dsav FINAL
      WHERE dsav.transactions_deleted_at IS NULL
    `
  }
}
