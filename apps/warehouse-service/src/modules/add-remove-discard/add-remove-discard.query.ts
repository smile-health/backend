import { Context } from "hono"
import { AddRemoveDiscardBaseQueryParams } from "./add-remove-discard.schema.js"
import { KFA_LEVEL_CODE } from "@/common/constants/material.js"
import { UsedFor } from "@/common/schemas/query-param.schema.js"

/**
 * Shared query builder for add-remove-discard modules
 * Used by both add-remove-stock and stock-discard modules
 */
export class AddRemoveDiscardQuery {
  constructor() {}

  /**
   * Generate common filters for add-remove-discard queries
   * @param c - Hono context
   * @param queryParams - Query parameters
   */
  #generateFilters(
    c: Context,
    queryParams: AddRemoveDiscardBaseQueryParams
  ): string {
    const {
      province_id,
      regency_id,
      activity_ids,
      material_ids,
      material_type_ids,
      material_level_id,
      entity_id,
      entity_tag_ids,
      reason_ids,
      transaction_type,
    } = queryParams

    let filters = ""

    // Base filters
    filters += ` AND dtv.program_id = ${c.var.programId}`
    filters += ` AND dtv.transactions_deleted_at IS NULL`
    filters += ` AND dtv.master_deleted_at IS NULL`

    // Date range filter
    filters += ` AND dtv.transactions_created_at BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}`

    // Geographic filters
    if (province_id) {
      filters += ` AND dtv.entities_province_id = {province_id:Int64}`
    }
    if (regency_id) {
      filters += ` AND dtv.entities_regency_id = {regency_id:Int64}`
    }

    // Activity filters
    if (activity_ids && activity_ids.length > 0) {
      filters += ` AND dtv.transactions_activity_id IN {activity_ids:Array(Int64)}`
    }

    // Material filters
    if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.TEMPLATE
    ) {
      filters += " AND dtv.dmm_parent_id in {material_ids:Array(Int64)}"
    } else if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.VARIANT
    ) {
      filters +=
        " AND dtv.transactions_master_material_id in {material_ids:Array(Int64)}"
    }

    if (material_type_ids && material_type_ids.length > 0) {
      filters += ` AND dtv.material_type_id IN {material_type_ids:Array(Int64)}`
    }

    // Entity filters
    if (entity_id) {
      filters += ` AND dtv.entities_id = {entity_id:Int64}`
    }
    if (entity_tag_ids && entity_tag_ids.length > 0) {
      filters += ` AND dtv.entity_tags_id IN {entity_tag_ids:Array(Int64)}`
    }

    // Transaction specific filters
    if (transaction_type && transaction_type.length > 0) {
      filters += ` AND dtv.transactions_transaction_type_id IN {transaction_type:Array(Int64)}`
    }

    if (reason_ids && reason_ids.length > 0) {
      filters += ` AND dtv.transactions_transaction_reason_id IN {reason_ids:Array(Int64)}`
    }

    // Entity activity date filter (if join_date and end_date are available)
    filters += ` AND dtv.join_date IS NOT NULL`
    filters += ` AND (dtv.end_date IS NULL OR dtv.end_date >= {to:DateTime('Asia/Jakarta')})`
    filters += ` AND dtv.join_date <= {to:DateTime('Asia/Jakarta')}`

    return filters
  }

  #generateClauses(
    queryParams: AddRemoveDiscardBaseQueryParams,
    usedFor: UsedFor
  ) {
    const {
      entity_id,
      entity_tag_ids,
      province_id,
      regency_id,
      material_level_id,
      period,
    } = queryParams
    let select = ""
    let groupBy = ""

    // Add specific fields based on endpoint type
    if (usedFor === "material") {
      if (material_level_id === KFA_LEVEL_CODE.TEMPLATE) {
        select += "dtv.dmm_parent_id as master_material_id,"
      } else if (material_level_id === KFA_LEVEL_CODE.VARIANT) {
        select += "dtv.transactions_master_material_id as master_material_id,"
      }

      groupBy += "master_material_id,"
    } else if (usedFor === "entity") {
      select += "dtv.entities_id,"
      groupBy += "dtv.entities_id,"
    } else if (usedFor === "location") {
      // Location grouping logic based on filters
      if (entity_id || entity_tag_ids || (province_id && regency_id)) {
        select += "dtv.entities_id as location_id,"
        groupBy += "dtv.entities_id,"
      } else if (province_id && !regency_id) {
        select += "dtv.entities_regency_id as location_id,"
        groupBy += "dtv.entities_regency_id,"
      } else {
        select += "dtv.entities_province_id as location_id,"
        groupBy += "dtv.entities_province_id,"
      }
    }

    // Add period fields based on period parameter
    switch (period) {
      case "day":
        select +=
          "toDate(dtv.transactions_created_at + interval 7 hour) as day,"
        groupBy += "day,"
        break
      case "week":
        select +=
          "toWeek(dtv.transactions_created_at + interval 7 hour) as week,"
        select +=
          "formatDateTime(dtv.transactions_created_at + interval 7 hour, '%Y') as year,"
        groupBy += "week, year,"
        break
      case "month":
        select +=
          "formatDateTime(dtv.transactions_created_at + interval 7 hour, '%Y-%m') as month,"
        groupBy += "month,"
        break
    }

    return { select, groupBy }
  }

  /**
   * Unified add-remove-discard data query builder
   * @param c - Hono context
   * @param queryParams - Query parameters
   * @param usedFor - Endpoint type (material, entity, location, review)
   */
  buildAddRemoveDiscardQuery(
    c: Context,
    queryParams: AddRemoveDiscardBaseQueryParams,
    usedFor: UsedFor
  ): string {
    const filters = this.#generateFilters(c, queryParams)
    const { select, groupBy } = this.#generateClauses(queryParams, usedFor)

    const query = `
      SELECT
        ${select}
        dtv.transactions_transaction_reason_id as transaction_reason_id,
        SUM(
          CASE
            WHEN dtv.transactions_transaction_type_id = 9 THEN COALESCE(-dtv.transactions_change_qty, 0)
            ELSE ABS(COALESCE(dtv.transactions_change_qty, 0))
          END
        ) as change_qty
      FROM datamart_transactions_v5 dtv FINAL
      WHERE 1=1
        ${filters}
      GROUP BY 
        ${groupBy} transaction_reason_id
    `

    return query.trim()
  }

  /**
   * Build query to get last updated timestamp
   */
  buildLastUpdatedQuery(): string {
    const query = `
      SELECT MAX(dtv.transactions_updated_at) as last_updated
      FROM datamart_transactions_v5 dtv FINAL
      WHERE dtv.transactions_deleted_at IS NULL
    `

    return query.trim()
  }
}
