import { Context } from "hono"
import { ReconciliationQueryParams } from "./reconciliation.schema.js"

export class ReconciliationQuery {
  constructor() {}

  #generateFilters(queryParams: ReconciliationQueryParams) {
    const { entity_id, activity_id, province_id, regency_id, entity_tag_id } =
      queryParams

    let filters = ""

    filters += " AND master_deleted_at IS NULL"

    filters += ` AND reconciliation_created_at BETWEEN {start_date:DateTime('Asia/Jakarta')} AND {end_date:DateTime('Asia/Jakarta')}`

    if (entity_id) {
      filters += ` AND entity_id = {entity_id:Int32}`
    }
    if (activity_id) {
      filters += ` AND activity_id = {activity_id:Int32}`
    }
    if (province_id) {
      filters += ` AND entity_province_id = {province_id:String}`
    }
    if (regency_id) {
      filters += ` AND entity_regency_id = {regency_id:String}`
    }
    if (entity_tag_id) {
      filters += ` AND entity_tag_id = {entity_tag_id:Int64}`
    }

    return { filters }
  }

  buildReconciliationBarReportQuery(
    c: Context,
    queryParams: ReconciliationQueryParams
  ) {
    const { filters } = this.#generateFilters(queryParams)

    return `
      SELECT
        toMonth(reconciliation_created_at + interval 7 hour) AS month,
        toYear(reconciliation_created_at + interval 7 hour) AS year,
        count(*) AS value
      FROM datamart_reconciliations_v5 FINAL
      WHERE
        reconciliation_deleted_at IS NULL
        AND program_id = ${c.var.programId}
        ${filters}
      GROUP BY
        month,
        year
      ORDER BY
        year,
        month
    `
  }

  buildReconciliationEntityReportQuery(
    c: Context,
    queryParams: ReconciliationQueryParams
  ) {
    const { filters } = this.#generateFilters(queryParams)

    return `
      SELECT
        entity_id,
        entity_name,
        toMonth(reconciliation_created_at + interval 7 hour) AS month,
        toYear(reconciliation_created_at + interval 7 hour) AS year,
        count(*) AS value
      FROM datamart_reconciliations_v5 FINAL
      WHERE
        reconciliation_deleted_at IS NULL
        AND program_id = ${c.var.programId}
        ${filters}
      GROUP BY
        entity_id,
        entity_name,
        month,
        year
      ORDER BY
        entity_id,
        year,
        month
    `
  }
}
