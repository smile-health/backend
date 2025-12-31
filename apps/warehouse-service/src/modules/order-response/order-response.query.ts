import { Context } from "hono"
import { OrderResponseQueryParams } from "./order-response.schema.js"
import { KFA_LEVEL_CODE } from "@/common/constants/material.js"
import { UsedFor } from "@/common/schemas/query-param.schema.js"
import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { ORDER_STATUS } from "@/common/constants/order.js"

export class OrderResponseQuery {
  constructor() {}

  /**
   * Generate common filters for order response queries
   */
  #generateFilters(c: Context, queryParams: OrderResponseQueryParams): string {
    const {
      province_id,
      regency_id,
      activity_ids,
      material_ids,
      material_level_id,
      entity_id,
      entity_tag_ids,
    } = queryParams

    let filters = ""

    // Base filters
    filters += ` AND dolv.program_id = ${c.var.programId}`
    filters += ` AND dolv.deleted_at IS NULL`
    filters += ` AND dolv.customer_status = 1`
    filters += ` AND dolv.customer_type <> ${ENTITY_TYPE.CENTER}`
    filters += ` AND dolv.entity_activity_start_date IS NOT NULL`
    filters += ` AND dolv.status_id = ${ORDER_STATUS.FULFILLED}`

    // Date range filter
    filters += ` AND dolv.order_created_at BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}`

    // Geographic filters
    if (province_id) {
      filters += ` AND dolv.customer_province_id = {province_id:Int64}`
    }
    if (regency_id) {
      filters += ` AND dolv.customer_regency_id = {regency_id:Int64}`
    }

    // Activity filters
    if (activity_ids && activity_ids.length > 0) {
      filters += ` AND dolv.activity_id IN {activity_ids:Array(Int64)}`
    }

    // Material filters
    if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.TEMPLATE
    ) {
      filters +=
        " AND arrayExists(i -> i in {material_ids:Array(Int64)}, dolv.parent_material_id)"
    } else if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.VARIANT
    ) {
      filters +=
        " AND arrayExists(i -> i in {material_ids:Array(Int64)}, dolv.material_id)"
    }

    // Entity filters
    if (entity_id) {
      filters += ` AND dolv.customer_id = {entity_id:Int64}`
    }
    if (entity_tag_ids && entity_tag_ids.length > 0) {
      filters += ` AND dolv.customer_entity_tag_id IN {entity_tag_ids:Array(Int64)}`
    }

    // Entity activity date filter (equivalent to the old JOIN logic)
    filters += ` AND (dolv.entity_activity_end_date IS NULL OR dolv.entity_activity_end_date >= {to:DateTime('Asia/Jakarta')})`
    filters += ` AND dolv.entity_activity_start_date <= {to:DateTime('Asia/Jakarta')}`

    return filters
  }

  #generateClauses(queryParams: OrderResponseQueryParams, usedFor: UsedFor) {
    const {
      entity_id,
      entity_tag_ids,
      province_id,
      regency_id,
      material_level_id,
      period,
    } = queryParams
    let selectFields = ""
    let materialJoin = ""
    let groupBy = ""

    // Add specific fields based on endpoint type
    if (usedFor === "material") {
      if (material_level_id === KFA_LEVEL_CODE.TEMPLATE) {
        materialJoin = "ARRAY JOIN dolv.parent_material_id AS material_id_array"
      } else {
        materialJoin = "ARRAY JOIN dolv.material_id AS material_id_array"
      }

      selectFields += "material_id_array,"
      groupBy += "material_id_array,"
    } else if (usedFor === "entity") {
      selectFields += "dolv.customer_id, dolv.customer_name,"
      groupBy += "dolv.customer_id, dolv.customer_name,"
    } else if (usedFor === "location") {
      // Location grouping logic based on filters
      if (entity_id || entity_tag_ids || (province_id && regency_id)) {
        selectFields += "dolv.customer_id as location_id, dolv.customer_name,"
        groupBy += "dolv.customer_id as location_id, dolv.customer_name,"
      } else if (province_id && !regency_id) {
        selectFields +=
          "dolv.customer_regency_id as location_id, dolv.customer_regency_name,"
        groupBy +=
          "dolv.customer_regency_id as location_id, dolv.customer_regency_name,"
      } else {
        selectFields +=
          "dolv.customer_province_id as location_id, dolv.customer_province_name,"
        groupBy +=
          "dolv.customer_province_id as location_id, dolv.customer_province_name,"
      }
    }

    // Add period fields based on period parameter
    switch (period) {
      case "day":
        selectFields +=
          "toDate(dolv.order_created_at + interval 7 hour) as day,"
        groupBy += "day"
        break
      case "week":
        selectFields +=
          "toWeek(dolv.order_created_at + interval 7 hour) as week,"
        selectFields +=
          "formatDateTime(dolv.order_created_at + interval 7 hour, '%Y') as year,"
        groupBy += "week, year"
        break
      case "month":
        selectFields +=
          "formatDateTime(dolv.order_created_at + interval 7 hour, '%Y-%m') as month,"
        groupBy += "month"
        break
    }

    return { selectFields, materialJoin, groupBy }
  }

  /**
   * Build order response query using the new datamart_order_list_v5 schema
   */
  buildOrderResponseQuery(
    c: Context,
    queryParams: OrderResponseQueryParams,
    usedFor: UsedFor
  ): string {
    const filters = this.#generateFilters(c, queryParams)
    const { selectFields, materialJoin, groupBy } = this.#generateClauses(
      queryParams,
      usedFor
    )

    const query = `
      SELECT
        ${selectFields}
        AVG(dolv.duration_order_to_allocation) / 86400 AS doa,
        AVG(dolv.duration_allocation_to_shipped) / 86400 AS das,
        AVG(dolv.duration_shipped_to_received) / 86400 AS dsr
      FROM datamart_order_list_v5 dolv FINAL
      ${materialJoin}
      WHERE 1=1
        ${filters}
      GROUP BY ${groupBy}
    `

    return query.trim()
  }

  /**
   * Get last updated timestamp
   */
  buildLastUpdatedQuery(): string {
    return `
      SELECT
        formatDateTime(max(dolv.order_updated_at), '%Y-%m-%d %H:%i:%s') as last_updated
      FROM datamart_order_list_v5 dolv FINAL
      WHERE dolv.deleted_at IS NULL
    `
  }
}
