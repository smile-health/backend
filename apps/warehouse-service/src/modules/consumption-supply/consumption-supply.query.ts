import { Context } from "hono"
import { ConsumptionSupplyQueryParams } from "./consumption-supply.schema.js"
import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { KFA_LEVEL_CODE } from "@/common/constants/material.js"
import { UsedFor } from "@/common/schemas/query-param.schema.js"

export class ConsumptionSupplyQuery {
  constructor() {}

  /**
   * Generate common filters for consumption supply queries
   */
  #generateFilters(
    c: Context,
    queryParams: ConsumptionSupplyQueryParams
  ): string {
    const {
      province_id,
      regency_id,
      entity_id,
      entity_tag_ids,
      material_ids,
      material_level_id,
      material_type_ids,
      activity_ids,
    } = queryParams

    let filters = ""

    // Base filters
    filters += ` AND dt.program_id = ${c.var.programId}`
    filters += ` AND dt.transactions_deleted_at IS NULL`
    filters += ` AND dt.master_deleted_at IS NULL`

    // Date range filter
    filters += ` AND dt.transactions_created_at BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}`

    // Geographic filters
    if (province_id) {
      filters += ` AND dt.entities_province_id = {province_id:Int64}`
    }
    if (regency_id) {
      filters += ` AND dt.entities_regency_id = {regency_id:Int64}`
    }

    // Entity filters
    if (entity_id) {
      filters += ` AND dt.entities_id = {entity_id:Int64}`
    }
    if (entity_tag_ids && entity_tag_ids.length > 0) {
      filters += ` AND dt.entity_tags_id IN {entity_tag_ids:Array(Int64)}`
    }

    // Material filters
    if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.TEMPLATE
    ) {
      filters += " AND dt.dmm_parent_id in {material_ids:Array(Int64)}"
    } else if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.VARIANT
    ) {
      filters +=
        " AND dt.transactions_master_material_id in {material_ids:Array(Int64)}"
    }

    if (material_type_ids && material_type_ids.length > 0) {
      filters += ` AND dt.material_type_id IN {material_type_ids:Array(Int64)}`
    }

    if (activity_ids && activity_ids.length > 0) {
      filters += ` AND dt.transactions_activity_id IN {activity_ids:Array(Int64)}`
    }

    // Exclude vendor entities and center type (corrected logic)
    filters += ` AND dt.entities_is_vendor = 1`
    filters += ` AND dt.entities_type <> ${ENTITY_TYPE.CENTER}`

    return filters
  }

  #generateClauses(
    queryParams: ConsumptionSupplyQueryParams,
    usedFor: UsedFor
  ) {
    const {
      province_id,
      regency_id,
      entity_id,
      entity_tag_ids,
      material_level_id,
      period,
    } = queryParams

    let selectFields = ""
    let groupBy = ""

    // Add specific fields based on endpoint type
    if (usedFor === "material") {
      if (material_level_id === KFA_LEVEL_CODE.TEMPLATE) {
        selectFields += "dmm_parent_id as material_id,"
      } else if (material_level_id === KFA_LEVEL_CODE.VARIANT) {
        selectFields += "transactions_master_material_id as material_id,"
      }

      groupBy += "material_id,"
    } else if (usedFor === "entity") {
      selectFields += "dt.entities_id as entity_id, dt.entities_name,"
      groupBy += "dt.entities_id, dt.entities_name,"
    } else if (usedFor === "location") {
      // Location grouping logic based on filters
      if (entity_id || entity_tag_ids || (province_id && regency_id)) {
        selectFields += "dt.entities_id as location_id, dt.entities_name,"
        groupBy += "dt.entities_id as location_id, dt.entities_name,"
      } else if (province_id && !regency_id) {
        selectFields +=
          "dt.entities_regency_id as location_id, dt.entities_regency_name,"
        groupBy +=
          "dt.entities_regency_id as location_id, dt.entities_regency_name,"
      } else {
        selectFields +=
          "dt.entities_province_id as location_id, dt.entities_province_name,"
        groupBy +=
          "dt.entities_province_id as location_id, dt.entities_province_name,"
      }
    }

    // Add period fields based on period parameter
    switch (period) {
      case "day":
        selectFields +=
          "toDate(dt.transactions_created_at + interval 7 hour) as day,"
        groupBy += "day"
        break
      case "week":
        selectFields +=
          "toWeek(dt.transactions_created_at + interval 7 hour) as week,"
        selectFields +=
          "formatDateTime(dt.transactions_created_at + interval 7 hour, '%Y') as year,"
        groupBy += "week, year"
        break
      case "month":
        selectFields +=
          "formatDateTime(dt.transactions_created_at + interval 7 hour, '%Y-%m') as month,"
        groupBy += "month"
        break
    }

    return { selectFields, groupBy }
  }

  /**
   * Unified consumption supply data query builder
   * @param c - Hono context
   * @param queryParams - Query parameters
   * @param usedFor - UsedFor interface
   */
  buildConsumptionSupplyQuery(
    c: Context,
    queryParams: ConsumptionSupplyQueryParams,
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
        COALESCE(sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id IN (10,5) AND transactions_order_id IS NULL),0)
        + COALESCE(sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id IN (4,5)),0)
        + COALESCE(sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id IN (4,5)),0)
        as consumption,
        COALESCE(sum(transactions_change_qty) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id = 5),0)
        + COALESCE(sum(transactions_change_qty) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id = 5),0)
        as supply
      FROM datamart_monitoring_transactions_v5 dt FINAL
      WHERE 1=1
        ${filters}
      GROUP BY ${groupBy}
    `

    return query.trim()
  }

  /**
   * Build query to get last updated timestamp
   */
  buildLastUpdatedQuery(): string {
    const query = `
      SELECT MAX(dt.transactions_updated_at) as last_updated
      FROM datamart_monitoring_transactions_v5 dt FINAL
      WHERE dt.transactions_deleted_at IS NULL
    `

    return query.trim()
  }
}
