import { Context } from "hono"
import {
  MaterialQueryParams,
  MaterialEntityQueryParams,
} from "./material.schema.js"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { IS_SO_MANDATORY } from "@/common/constants/stock-opname.js"

export class MaterialQuery {
  constructor() {}

  #generateMaterialClauses(
    queryParams: MaterialQueryParams,
    paginationOption: PaginationOption
  ) {
    const { paginate, offset } = queryParams
    const { is_paginate, count } = paginationOption

    let pagination = ""
    let select = ""
    let groupBy = ""
    let orderBy = ""
    if (count === true) {
      pagination = ""
      select = "COUNT(DISTINCT rwm.id) as count"
      groupBy = ""
    } else if (is_paginate === false && count === false) {
      pagination = ""
      select = `
        rwm.id AS id,
        rwm.name AS name,
        rwm.code as code,
        rwm.is_stock_opname_mandatory as is_stock_opname_mandatory,
        rwm.material_type_id as material_type_id
      `
      groupBy =
        "GROUP BY rwm.id, rwm.name, rwm.code, rwm.is_stock_opname_mandatory, rwm.material_type_id"
      orderBy = "ORDER BY rwm.name ASC"
    } else {
      pagination = `LIMIT ${paginate} OFFSET ${offset}`
      select = `
        rwm.id AS id,
        rwm.name AS name,
        rwm.code as code,
        rwm.is_stock_opname_mandatory as is_stock_opname_mandatory,
        rwm.material_type_id as material_type_id
      `
      groupBy =
        "GROUP BY rwm.id, rwm.name, rwm.code, rwm.is_stock_opname_mandatory, rwm.material_type_id"
      orderBy = "ORDER BY rwm.name ASC"
    }

    return { pagination, select, groupBy, orderBy }
  }

  #generateMaterialFilters(queryParams: MaterialQueryParams) {
    const {
      material_id,
      material_ids,
      material_level_id,
      material_is_stock_opname_mandatory,
      activity_id,
      activity_ids,
    } = queryParams

    let filters = ""
    filters += material_id ? " AND rwm.id = {material_id:Int64}" : ""
    filters += material_ids ? " AND rwm.id in {material_ids:Array(Int64)}" : ""
    filters += material_level_id
      ? " AND rwm.material_level_id = {material_level_id:Int64}"
      : ""
    filters += activity_id ? " AND rwma.activity_id = {activity_id:Int64}" : ""
    filters += activity_ids
      ? " AND rwma.activity_id in {activity_ids:Array(Int64)}"
      : ""
    filters += material_is_stock_opname_mandatory
      ? " AND rwm.is_stock_opname_mandatory = {material_is_stock_opname_mandatory:Int64}"
      : ""

    return { filters }
  }

  buildMaterialQuery(
    c: Context,
    queryParams: MaterialQueryParams,
    paginationOption: PaginationOption = {}
  ) {
    const programId = c.var.programId ?? queryParams.program_id

    const { pagination, select, groupBy, orderBy } =
      this.#generateMaterialClauses(queryParams, paginationOption)

    const { filters } = this.#generateMaterialFilters(queryParams)

    return `
      SELECT
        ${select}
      FROM raw_ws_materials AS rwm FINAL
      JOIN raw_ws_material_activities AS rwma FINAL ON rwma.material_id = rwm.id
      WHERE
        rwm.program_id = ${programId}
        AND rwm.deleted_at is null
        ${filters}
      ${groupBy}
      ${orderBy}
      ${pagination}
    `
  }

  buildSoMaterialDenomQuery(c: Context, queryParams: MaterialQueryParams) {
    const programId = c.var.programId ?? queryParams.program_id

    let filters = ""
    filters += queryParams.activity_id
      ? " AND dwema.ema_activity_id = {activity_id:Int64}"
      : ""
    filters += queryParams.activity_ids
      ? " AND dwema.ema_activity_id in {activity_ids:Array(Int64)}"
      : ""
    filters += queryParams.material_id
      ? " AND dwema.ema_material_id = {material_id:Int64}"
      : ""
    filters += queryParams.material_ids
      ? " AND dwema.ema_material_id in {material_ids:Array(Int64)}"
      : ""

    return `
      SELECT 
        dwema.ema_entity_id as entity_id,
        count(distinct dwema.ema_material_id) as total_material_denom
      FROM dim_ws_entity_material_activities dwema 
      PREWHERE dwema.program_id = ${programId} AND dwema.has_transaction_already = 1
      WHERE 
        dwema.material_is_stock_opname_mandatory = ${IS_SO_MANDATORY.TRUE}
        ${filters}
      GROUP BY dwema.ema_entity_id 
    `
  }

  #generateMaterialEntityFilters(queryParams: MaterialEntityQueryParams) {
    const {
      material_id,
      material_ids,
      material_is_stock_opname_mandatory,
      activity_id,
      activity_ids,
      entity_id,
      entity_ids,
    } = queryParams

    let filters = ""
    filters += material_id
      ? " AND dwema.ema_material_id = {material_id:Int64}"
      : ""
    filters += material_ids
      ? " AND dwema.ema_material_id in {material_ids:Array(Int64)}"
      : ""
    filters += activity_id
      ? " AND dwema.ema_activity_id = {activity_id:Int64}"
      : ""
    filters += activity_ids
      ? " AND dwema.ema_activity_id in {activity_ids:Array(Int64)}"
      : ""
    filters += entity_id ? " AND dwema.ema_entity_id = {entity_id:Int64}" : ""
    filters += entity_ids
      ? " AND dwema.ema_entity_id in {entity_ids:Array(Int64)}"
      : ""
    filters += material_is_stock_opname_mandatory
      ? " AND dwema.material_is_stock_opname_mandatory = {material_is_stock_opname_mandatory:Int64}"
      : ""

    return { filters }
  }

  #generateMaterialEntityClauses(
    queryParams: MaterialEntityQueryParams,
    paginationOption: PaginationOption
  ) {
    const { paginate, offset } = queryParams
    const { is_paginate, count } = paginationOption

    let pagination = ""
    let select = ""
    let groupBy = ""
    let orderBy = ""
    if (count === true) {
      pagination = ""
      select = "COUNT(DISTINCT dwema.ema_material_id) as count"
      groupBy = ""
    } else if (is_paginate === false && count === false) {
      pagination = ""
      select = `
        dwema.ema_material_id AS id,
        dwema.material_name AS name,
        dwema.material_is_stock_opname_mandatory as is_stock_opname_mandatory
      `
      groupBy =
        "GROUP BY dwema.ema_material_id, dwema.material_name, dwema.material_is_stock_opname_mandatory"
      orderBy = "ORDER BY dwema.material_name ASC"
    } else {
      pagination = `LIMIT ${paginate} OFFSET ${offset}`
      select = `
        dwema.ema_material_id AS id,
        dwema.material_name AS name,
        dwema.material_is_stock_opname_mandatory as is_stock_opname_mandatory
      `
      groupBy =
        "GROUP BY dwema.ema_material_id, dwema.material_name, dwema.material_is_stock_opname_mandatory"
      orderBy = "ORDER BY dwema.material_name ASC"
    }

    return { pagination, select, groupBy, orderBy }
  }

  buildMaterialEntitiesQuery(
    c: Context,
    queryParams: MaterialEntityQueryParams,
    paginationOption: PaginationOption = {}
  ) {
    const programId = c.var.programId ?? queryParams.program_id

    const { pagination, select, groupBy, orderBy } =
      this.#generateMaterialEntityClauses(queryParams, paginationOption)

    const { filters } = this.#generateMaterialEntityFilters(queryParams)

    return `
      SELECT
        ${select}
      FROM dim_ws_entity_material_activities AS dwema FINAL
      WHERE
        dwema.program_id = ${programId}
        AND dwema.ema_deleted_at is null
        ${filters}
      ${groupBy}
      ${orderBy}
      ${pagination}
    `
  }
}
