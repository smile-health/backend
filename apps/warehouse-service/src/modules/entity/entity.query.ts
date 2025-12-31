import {
  ENTITY_IS_VENDOR,
  ENTITY_STATUS,
  ENTITY_TYPE,
} from "@/common/constants/entity.js"
import { EntityQueryParams } from "./entity.schema.js"
import { Context } from "hono"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { KFA_LEVEL_CODE } from "@/common/constants/material.js"

export class EntityQuery {
  constructor() {}

  #generateEntityClauses(
    queryParams: EntityQueryParams,
    paginationOption: PaginationOption
  ) {
    const { paginate, offset } = queryParams
    const { is_paginate, count } = paginationOption

    let pagination = ""
    let select = ""
    let orderBy = ""
    if (count === true) {
      pagination = ""
      select = "COUNT(DISTINCT dwema.ema_entity_id) as count"
    } else if (is_paginate === false && count === false) {
      pagination = ""
      select = `
        DISTINCT
          dwema.ema_entity_id as id, 
          dwema.entity_name as name, 
          dwema.entity_type as type,
          dwema.entity_province_id as province_id,
          dwema.entity_regency_id as regency_id,
          dwema.entity_province_name as province_name,
          dwema.entity_regency_name as regency_name,
          dwema.entity_tag_id as entity_tag_id,
          dwema.entity_tag_title as entity_tag_name
      `
      orderBy = "ORDER BY dwema.ema_entity_id ASC"
    } else {
      pagination = `LIMIT ${paginate} OFFSET ${offset}`
      select = `
        DISTINCT
          dwema.ema_entity_id as id, 
          dwema.entity_name as name, 
          dwema.entity_type as type,
          dwema.entity_province_id as province_id,
          dwema.entity_regency_id as regency_id,
          dwema.entity_province_name as province_name,
          dwema.entity_regency_name as regency_name,
          dwema.entity_tag_id as entity_tag_id,
          dwema.entity_tag_title as entity_tag_name
      `
      orderBy = "ORDER BY dwema.ema_entity_id ASC"
    }

    return { pagination, select, orderBy }
  }

  #generateEntityFilters(queryParams: EntityQueryParams) {
    const {
      entity_id,
      entity_ids,
      province_id,
      province_ids,
      regency_id,
      regency_ids,
      entity_tag_id,
      entity_tag_ids,
      entity_type_id,
      entity_type_ids,
      material_id,
      material_ids,
      material_level_id,
      material_is_stock_opname_mandatory,
      activity_ids,
      activity_id,
      exlcude_entity_type_center,
    } = queryParams

    let filters = ""
    filters += entity_id ? " AND dwema.ema_entity_id = {entity_id:Int64}" : ""
    filters += entity_ids
      ? " AND dwema.ema_entity_id in {entity_ids:Array(Int64)}"
      : ""
    filters += entity_type_id
      ? " AND dwema.entity_type = {entity_type_id:Int64}"
      : ""
    filters += entity_type_ids
      ? " AND dwema.entity_type in {entity_type_ids:Array(Int64)}"
      : ""
    filters += exlcude_entity_type_center
      ? ` AND dwema.entity_type != ${ENTITY_TYPE.CENTER}`
      : ""
    filters += province_id
      ? " AND toInt64(dwema.entity_province_id) = {province_id:Int64}"
      : ""
    filters += province_ids
      ? " AND toInt64(dwema.entity_province_id) in {province_ids:Array(Int64)}"
      : ""
    filters += regency_id
      ? " AND toInt64(dwema.entity_regency_id) = {regency_id:Int64}"
      : ""
    filters += regency_ids
      ? " AND toInt64(dwema.entity_regency_id) in {regency_ids:Array(Int64)}"
      : ""
    filters += entity_tag_id
      ? " AND dwema.entity_tag_id = {entity_tag_id:Int64}"
      : ""
    filters += entity_tag_ids
      ? " AND dwema.entity_tag_id in {entity_tag_ids:Array(Int64)}"
      : ""
    filters +=
      material_ids && material_level_id === KFA_LEVEL_CODE.TEMPLATE
        ? " AND dwema.ema_material_id in {material_ids:Array(Int64)}"
        : ""
    filters +=
      material_id && material_level_id === KFA_LEVEL_CODE.TEMPLATE
        ? " AND dwema.ema_material_id = {material_id:Int64}"
        : ""
    filters += material_is_stock_opname_mandatory
      ? " AND dwema.material_is_stock_opname_mandatory = {material_is_stock_opname_mandatory:Int64}"
      : ""
    filters += activity_id
      ? " AND dwema.ema_activity_id = {activity_id:Int64}"
      : ""
    filters += activity_ids
      ? " AND dwema.ema_activity_id in {activity_ids:Array(Int64)}"
      : ""

    return { filters }
  }

  buildEntityQuery(
    c: Context,
    queryParams: EntityQueryParams,
    paginationOption: PaginationOption = {}
  ) {
    const programId = c.var.programId ?? queryParams.program_id

    const { pagination, select, orderBy } = this.#generateEntityClauses(
      queryParams,
      paginationOption
    )

    const { filters } = this.#generateEntityFilters(queryParams)

    const additionalPrewhere = queryParams.has_transaction_already
      ? " AND dwema.has_transaction_already = {has_transaction_already:Int64}"
      : ""

    const query = `
      SELECT
        ${select}
      FROM 
        dim_ws_entity_material_activities dwema FINAL
      PREWHERE 
        dwema.program_id = ${programId} 
        AND dwema.entity_is_vendor = ${ENTITY_IS_VENDOR.IS_VENDOR}
        AND dwema.entity_status = ${ENTITY_STATUS.ACTIVE}
        ${additionalPrewhere}
      WHERE 
        dwema.ema_deleted_at is null
        AND dwema.entity_activity_start_date is not null        
        AND (
          (
            dwema.entity_activity_start_date <= {to:DateTime('Asia/Jakarta')} 
            AND dwema.entity_activity_end_date >= {to:DateTime('Asia/Jakarta')}
          ) 
          OR (
            dwema.entity_activity_end_date is null 
            AND dwema.entity_activity_start_date <= {to:DateTime('Asia/Jakarta')}
          )
        )
        ${filters}
      ${orderBy}
      ${pagination} 
    `

    return query
  }
}
