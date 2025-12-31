import moment from "moment"
import { UserActivityQueryParams } from "./user-activity.schema.js"
import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"

function getMaterialIdsCondition(queryParams: UserActivityQueryParams): string {
  let condition = ""
  if (queryParams.material_ids && queryParams.material_ids.length > 0) {
    condition = ` AND dt.transactions_master_material_id IN {material_ids:Array(Int64)} `
  }
  return condition
}

function getActivityIdsCondition(queryParams: UserActivityQueryParams): string {
  let condition = ""
  if (queryParams.activity_ids && queryParams.activity_ids.length > 0) {
    condition =
      " AND dt.transactions_activity_id IN {activity_ids:Array(Int64)} "
  }
  return condition
}

function getMaterialTypeIdsCondition(
  queryParams: UserActivityQueryParams,
  isUser: boolean = false
): string {
  let condition = ""
  if (
    queryParams.material_type_ids &&
    queryParams.material_type_ids.length > 0
  ) {
    condition = ` AND ${isUser ? "mt.id" : "dt.material_type_id"} IN {is_vaccine:Array(Int64)} `
  }
  return condition
}

function getEntityIdCondition(queryParams: UserActivityQueryParams): string {
  let condition = ""
  if (queryParams.entity_id != undefined) {
    condition = " AND dt.entities_id = {entity_id:Int} "
  }

  return condition
}

function getCustomerIdCondition(queryParams: UserActivityQueryParams): string {
  let condition = ""
  if (queryParams.customer_id != undefined) {
    condition = " AND dt.customer_id = {customer_id:Int} "
  }

  return condition
}

function getCustomerEntityTagIdCondition(queryParams: UserActivityQueryParams): string {
  let condition = ""
  if (queryParams.customer_entity_tag_id != undefined) {
    condition = " AND dt.customer_entity_tag_id = {customer_entity_tag_id:Int} "
  }

  return condition
}

function getEntityTagIdsCondition(
  queryParams: UserActivityQueryParams
): string {
  let condition = ""
  if (queryParams.entity_tag_ids && queryParams.entity_tag_ids.length > 0) {
    condition = " AND dt.entity_tags_id IN {entity_tag_ids:Array(Int64)} "
  }

  return condition
}

function getEntityProvinceId(queryParams: UserActivityQueryParams): string {
  let condition = ""
  if (queryParams.province_id != undefined) {
    condition = " AND dt.entities_province_id = {province_id:Int}"
  }

  return condition
}

function getEntityRegencyId(queryParams: UserActivityQueryParams): string {
  let condition = ""
  if (queryParams.regency_id != undefined) {
    condition = " AND dt.entities_regency_id = {regency_id:Int}"
  }

  return condition
}

export function conditionQuery(
  queryParams: UserActivityQueryParams,
  isUser: boolean = false
) {
  let conditionQuery = ""
  conditionQuery += getMaterialIdsCondition(queryParams)
  conditionQuery += getActivityIdsCondition(queryParams)
  conditionQuery += getMaterialTypeIdsCondition(queryParams, isUser)
  conditionQuery += getEntityIdCondition(queryParams)
  conditionQuery += getCustomerIdCondition(queryParams)
  conditionQuery += getCustomerEntityTagIdCondition(queryParams)
  conditionQuery += getEntityTagIdsCondition(queryParams)
  conditionQuery += getEntityProvinceId(queryParams)
  conditionQuery += getEntityRegencyId(queryParams)

  return conditionQuery
}

export function valueConditionQuery(queryParams: UserActivityQueryParams) {
  return {
    program_id: queryParams.program_id,
    from: `${queryParams.from} 00:00:00`,
    to: queryParams.to
      ? `${moment(queryParams.to).format("YYYY-MM-DD")} 23:59:59`
      : moment(new Date()).format("YYYY-MM-DD 23:59:59"),
    current_date: queryParams.current_date,
    activity_ids: queryParams.activity_ids,
    material_ids: queryParams.material_ids,
    entity_id: queryParams.entity_id,
    customer_id: queryParams.customer_id,
    customer_entity_tag_id: queryParams.customer_entity_tag_id,
    transaction_type: [TRANSACTION_TYPE.ISSUES, TRANSACTION_TYPE.CONSUMPTION],
    is_vaccine: queryParams.material_type_ids,
    province_id: queryParams.province_id,
    regency_id: queryParams.regency_id,
    entity_tag_ids: queryParams.entity_tag_ids,
  }
}
