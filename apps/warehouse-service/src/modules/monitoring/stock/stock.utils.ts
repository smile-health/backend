import { DASHBOARD_STOCK_INFORMATION_TYPE } from "@/common/constants/monitoring.js"
import { MonitoringStockSchemaQueryParams } from "./stock.schema.js"
import { Context } from "hono"

function getActivityIdsCondition(
  queryParams: MonitoringStockSchemaQueryParams
): string {
  if (queryParams.activity_ids && queryParams.activity_ids.length > 0) {
    return " AND stock_activity_id in {activity_ids:Array(Int64)} "
  }
  return ""
}

function getMaterialIdsCondition(
  queryParams: MonitoringStockSchemaQueryParams
): string {
  if (queryParams.material_ids && queryParams.material_ids.length > 0) {
    return ` AND ${queryParams.kfaMaterial?.columnId?.split(" ")[0]} in {material_ids:Array(Int64)} `
  }
  return ""
}

function getEntityIdCondition(
  queryParams: MonitoringStockSchemaQueryParams
): string {
  if (queryParams.entity_id != undefined) {
    if (
      queryParams.information_type ===
      DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_IN_TRANSIT
    ) {
      return " AND transactions_customer_id = {entity_id:Int}"
    } else {
      return " AND entities_id = {entity_id:Int} "
    }
  }
  return ""
}

function getMaterialTypeIdsCondition(
  queryParams: MonitoringStockSchemaQueryParams
): string {
  if (
    queryParams.material_type_ids &&
    queryParams.material_type_ids.length > 0
  ) {
    return " AND material_type_id in {is_vaccine:Array(Int64)} "
  }
  return ""
}

function getProvinceIdCondition(
  queryParams: MonitoringStockSchemaQueryParams
): string {
  if (queryParams.province_id != undefined) {
    if (
      queryParams.information_type ===
      DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_ON_HAND
    ) {
      return " AND entities_province_id = {province_id:Int} "
    } else {
      return " AND lp.id = {province_id:Int} "
    }
  }
  return ""
}

function getRegencyIdCondition(
  queryParams: MonitoringStockSchemaQueryParams
): string {
  if (queryParams.regency_id != undefined) {
    if (
      queryParams.information_type ===
      DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_ON_HAND
    ) {
      return " AND entities_regency_id = {regency_id:Int} "
    } else {
      return " AND lr.id = {regency_id:Int}"
    }
  }
  return ""
}

function getEntityTagIdsCondition(
  queryParams: MonitoringStockSchemaQueryParams
): string {
  if (queryParams.entity_tag_ids && queryParams.entity_tag_ids.length > 0) {
    if (
      queryParams.information_type ===
      DASHBOARD_STOCK_INFORMATION_TYPE.STOCK_ON_HAND
    ) {
      return " AND entity_tags_id in {entity_tag_ids:Array(Int64)} "
    } else {
      return " AND ec.entity_tag_id IN {entity_tag_ids:Array(Int64)}"
    }
  }
  return ""
}

function getExpiredDateCondition(
  queryParams: MonitoringStockSchemaQueryParams
): string {
  if (queryParams.start_expired_date && queryParams.end_expired_date) {
    return " AND toDate(s.expired_date) BETWEEN {start_expired_date:DateTime('Asia/Jakarta')} and {end_expired_date:DateTime('Asia/Jakarta')} "
  }
  return ""
}

export function conditionQuery(queryParams: MonitoringStockSchemaQueryParams) {
  let conditionQuery = ""
  conditionQuery += " AND s.program_id = {program_id:Int}"

  conditionQuery += getActivityIdsCondition(queryParams)
  conditionQuery += getMaterialIdsCondition(queryParams)
  conditionQuery += getEntityIdCondition(queryParams)
  conditionQuery += getMaterialTypeIdsCondition(queryParams)
  conditionQuery += getProvinceIdCondition(queryParams)
  conditionQuery += getRegencyIdCondition(queryParams)
  conditionQuery += getEntityTagIdsCondition(queryParams)
  conditionQuery += getExpiredDateCondition(queryParams)

  return conditionQuery
}

export function valueConditionQuery(
  c: Context,
  queryParams: MonitoringStockSchemaQueryParams
) {
  return {
    program_id: c.var.programId,
    from: queryParams.from,
    to: queryParams.to,
    activity_ids: queryParams.activity_ids,
    material_ids: queryParams.material_ids,
    entity_id: queryParams.entity_id,
    is_vaccine: queryParams.material_type_ids,
    province_id: queryParams.province_id,
    regency_id: queryParams.regency_id,
    entity_tag_ids: queryParams.entity_tag_ids,
    start_expired_date: queryParams.start_expired_date,
    end_expired_date: queryParams.end_expired_date,
  }
}
