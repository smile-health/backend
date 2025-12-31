import { Context } from "hono"
import { OrderDifferenceQueryParams } from "./order-difference.schema.js"
import { KFA_LEVEL_CODE } from "@/common/constants/material.js"
import { UsedFor } from "@/common/schemas/query-param.schema.js"
import { ORDER_STATUS } from "@/common/constants/order.js"
import { ENTITY_TYPE } from "@/common/constants/entity.js"

export class OrderDifferenceQuery {
  constructor() {}

  /**
   * Generate common filters for order difference queries
   */
  #generateFilters(
    c: Context,
    queryParams: OrderDifferenceQueryParams
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
      reason_id,
    } = queryParams

    let filters = ""

    // Base filters
    filters += ` AND dod.program_id = ${c.var.programId}`
    filters += ` AND dod.deleted_at IS NULL`
    filters += ` AND dod.master_deleted_at IS NULL`
    filters += ` AND dod.entity_type <> ${ENTITY_TYPE.CENTER}`
    filters += ` AND dod.order_status = ${ORDER_STATUS.FULFILLED}`

    // Date range filter
    filters += ` AND dod.order_created_at BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}`

    // Geographic filters
    if (province_id) {
      filters += ` AND dod.entity_province_id = {province_id:Int64}`
    }
    if (regency_id) {
      filters += ` AND dod.entity_regency_id = {regency_id:Int64}`
    }

    // Activity filters
    if (activity_ids && activity_ids.length > 0) {
      filters += ` AND dod.activity_id IN {activity_ids:Array(Int64)}`
    }

    // Material filters
    if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.TEMPLATE
    ) {
      filters += " AND dod.dmm_parent in {material_ids:Array(Int64)}"
    } else if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.VARIANT
    ) {
      filters += " AND dod.master_material_id in {material_ids:Array(Int64)}"
    }

    if (material_type_ids && material_type_ids.length > 0) {
      filters += ` AND dod.material_type_id IN {material_type_ids:Array(Int64)}`
    }

    filters += ` AND dod.material_level_id = ${KFA_LEVEL_CODE.VARIANT}`

    // Entity filters
    if (entity_id) {
      filters += ` AND dod.entities_id = {entity_id:Int64}`
    }
    if (entity_tag_ids && entity_tag_ids.length > 0) {
      filters += ` AND dod.entity_tag_id IN {entity_tag_ids:Array(Int64)}`
    }

    // Reason filter
    if (reason_id) {
      filters += ` AND dod.reason_id = {reason_id:Int64}`
    }

    // Entity activity date filter (equivalent to the old JOIN logic)
    filters += ` AND dod.entity_activity_start_date IS NOT NULL`
    filters += ` AND (dod.entity_activity_end_date IS NULL OR dod.entity_activity_end_date >= {to:DateTime('Asia/Jakarta')})`
    filters += ` AND dod.entity_activity_start_date <= {to:DateTime('Asia/Jakarta')}`

    return filters
  }

  #generateClauses(queryParams: OrderDifferenceQueryParams, usedFor: UsedFor) {
    const {
      entity_id,
      entity_tag_ids,
      province_id,
      regency_id,
      material_level_id,
      period,
    } = queryParams
    let selectFields = ""
    let groupBy = ""

    // Add specific fields based on endpoint type
    if (usedFor === "material") {
      if (material_level_id === KFA_LEVEL_CODE.TEMPLATE) {
        selectFields += "dod.dmm_parent as master_material_id,"
      } else if (material_level_id === KFA_LEVEL_CODE.VARIANT) {
        selectFields += "dod.master_material_id as master_material_id,"
      }

      groupBy += "master_material_id,"
    } else if (usedFor === "entity") {
      selectFields += "dod.entities_id,"
      groupBy += "dod.entities_id,"
    } else if (usedFor === "location") {
      // Location grouping logic based on filters
      if (entity_id || entity_tag_ids || (province_id && regency_id)) {
        selectFields += "dod.entities_id as location_id,"
        groupBy += "dod.entities_id as location_id,"
      } else if (province_id && !regency_id) {
        selectFields += "dod.entity_regency_id as location_id,"
        groupBy += "dod.entity_regency_id as location_id,"
      } else {
        selectFields += "dod.entity_province_id as location_id,"
        groupBy += "dod.entity_province_id as location_id,"
      }
    }

    // Add period fields based on period parameter
    switch (period) {
      case "day":
        selectFields += "toDate(dod.order_created_at + interval 7 hour) as day,"
        groupBy += "day"
        break
      case "week":
        selectFields +=
          "toWeek(dod.order_created_at + interval 7 hour) as week,"
        selectFields +=
          "formatDateTime(dod.order_created_at + interval 7 hour, '%Y') as year,"
        groupBy += "week, year"
        break
      case "month":
        selectFields +=
          "formatDateTime(dod.order_created_at + interval 7 hour, '%Y-%m') as month,"
        groupBy += "month"
        break
    }

    return { selectFields, groupBy }
  }

  /**
   * Unified order difference data query builder
   * @param c - Hono context
   * @param queryParams - Query parameters
   */
  buildOrderDifferenceQuery(
    c: Context,
    queryParams: OrderDifferenceQueryParams,
    usedFor: UsedFor
  ): string {
    const filters = this.#generateFilters(c, queryParams)
    const { selectFields, groupBy } = this.#generateClauses(
      queryParams,
      usedFor
    )

    const query = `
      SELECT
        ${selectFields}
        SUM(COALESCE(dod.sent, 0)) as sent,
        SUM(COALESCE(dod.received, 0)) as received,
        SUM(COALESCE(dod.ordered, 0)) as ordered,
        SUM(COALESCE(dod.recommended, 0)) as recommended
      FROM datamart_order_difference_v5 dod FINAL
      WHERE 1=1
        ${filters}
      GROUP BY
        ${groupBy}
    `

    return query.trim()
  }

  /**
   * Build query to get last updated timestamp
   */
  buildLastUpdatedQuery(): string {
    const query = `
      SELECT MAX(dod.updated_at) as last_updated
      FROM datamart_order_difference_v5 dod FINAL
      WHERE dod.deleted_at IS NULL
    `

    return query.trim()
  }
}
