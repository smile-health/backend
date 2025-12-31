import { Context } from "hono"
import { StockOpnameQueryParams } from "./stock-opname.schema.js"
import {
  ENTITY_IS_VENDOR,
  ENTITY_STATUS,
  ENTITY_TYPE,
} from "@/common/constants/entity.js"
import {
  HAS_TRANSACTION_ALREADY,
  IS_SO_MANDATORY,
  SO_STATUS,
} from "@/common/constants/stock-opname.js"
import { KFA_LEVEL_CODE } from "@/common/constants/material.js"

export class StockOpnameQuery {
  constructor() {}

  #generateClauses(queryParams: StockOpnameQueryParams, isSummaryBox: boolean) {
    const { entity_ids, entity_tag_ids, province_ids, regency_ids } =
      queryParams

    let select = ""
    let entitySelect = ""
    let groupBy = ""
    let orderBy = ""
    if (isSummaryBox) {
      select = "dso.entity_tag_id AS entity_tag_id"
      entitySelect = "dwema.entity_tag_id AS entity_tag_id"
      groupBy = "entity_tag_id"
      orderBy = "entity_tag_id"
    } else {
      if (entity_ids || entity_tag_ids) {
        select = "dso.entity_id AS location_id"
        entitySelect = "dwema.ema_entity_id AS location_id"
      } else if (province_ids && regency_ids) {
        select = "dso.entity_id AS location_id"
        entitySelect = "dwema.ema_entity_id AS location_id"
      } else if (province_ids && !regency_ids) {
        select =
          "COALESCE(toInt64(dso.regency_id), dso.entity_id) AS location_id"
        entitySelect =
          "COALESCE(toInt64(dwema.entity_regency_id), dwema.ema_entity_id) AS location_id"
      } else {
        select =
          "COALESCE(toInt64(dso.province_id), dso.entity_id) AS location_id"
        entitySelect =
          "COALESCE(toInt64(dwema.entity_province_id), dwema.ema_entity_id) AS location_id"
      }

      groupBy = "location_id"
      orderBy = "location_id"
    }

    return { select, entitySelect, groupBy, orderBy }
  }

  #generateFilters(queryParams: StockOpnameQueryParams) {
    const {
      material_ids,
      material_level_id,
      activity_ids,
      entity_ids,
      entity_tag_ids,
      province_ids,
      regency_ids,
      start_expired_date,
      end_expired_date,
      batch_code,
    } = queryParams

    let filters = ""
    filters += activity_ids
      ? " AND dso.stock_opname_activity_id in {activity_ids:Array(Int64)}"
      : ""
    filters += entity_ids
      ? " AND dso.entity_id in {entity_ids:Array(Int64)}"
      : ""
    filters += entity_tag_ids
      ? " AND dso.entity_tag_id in {entity_tag_ids:Array(Int64)}"
      : ""
    filters += province_ids
      ? " AND toInt64(dso.province_id) in {province_ids:Array(Int64)}"
      : ""
    filters += regency_ids
      ? " AND toInt64(dso.regency_id) in {regency_ids:Array(Int64)}"
      : ""
    filters +=
      start_expired_date && end_expired_date
        ? " AND dso.stock_opname_expired_date BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}"
        : ""
    filters += batch_code
      ? " AND dso.stock_opname_batch_code = {batch_code:String}"
      : ""
    filters += " AND dso.master_deleted_at IS NULL"

    if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.TEMPLATE
    ) {
      filters +=
        " AND dso.stock_opname_parent_material_id in {material_ids:Array(Int64)}"
    } else if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.VARIANT
    ) {
      filters +=
        " AND dso.stock_opname_material_id in {material_ids:Array(Int64)}"
    }

    let entityFilters = ""
    entityFilters += material_ids
      ? " AND dwema.ema_material_id in {material_ids:Array(Int64)}"
      : ""
    entityFilters += activity_ids
      ? " AND dwema.ema_activity_id in {activity_ids:Array(Int64)}"
      : ""
    entityFilters += entity_ids
      ? " AND dwema.ema_entity_id in {entity_ids:Array(Int64)}"
      : ""
    entityFilters += entity_tag_ids
      ? " AND dwema.entity_tag_id in {entity_tag_ids:Array(Int64)}"
      : ""
    entityFilters += province_ids
      ? " AND toInt64(dwema.entity_province_id) in {province_ids:Array(Int64)}"
      : ""
    entityFilters += regency_ids
      ? " AND toInt64(dwema.entity_regency_id) in {regency_ids:Array(Int64)}"
      : ""

    return { filters, entityFilters }
  }

  buildStockOpnameComplianceQuery(
    c: Context,
    queryParams: StockOpnameQueryParams,
    isSummaryBox: boolean
  ) {
    const programId = c.var.programId ?? queryParams.program_id
    const { filters } = this.#generateFilters(queryParams)

    const { select, groupBy, orderBy } = this.#generateClauses(
      queryParams,
      isSummaryBox
    )

    return `
      SELECT
        ${select},
        count(DISTINCT dso.entity_id) AS count
      FROM
        datamart_stock_opname_v5 AS dso FINAL
      JOIN (
        SELECT
          rwea_inner.id,
          rwea_inner.entity_id,
          rwea_inner.activity_id
        FROM raw_ws_entity_activities AS rwea_inner FINAL
        WHERE
          rwea_inner.start_date is not null
          AND (
            (start_date <= {to:DateTime('Asia/Jakarta')} AND end_date >= {to:DateTime('Asia/Jakarta')})
            OR (end_date is null AND start_date <= {to:DateTime('Asia/Jakarta')})
          )
      ) AS rwea ON dso.entity_id = rwea.entity_id AND dso.stock_opname_activity_id = rwea.activity_id
      PREWHERE dso.stock_opname_updated_at BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')} 
      AND dso.stock_opname_program_id = ${programId}
      WHERE
        dso.so_within_period = ${SO_STATUS.DONE}
        AND dso.stock_opname_deleted_at is null
        AND dso.stock_opname_material_is_stock_opname_mandatory = ${IS_SO_MANDATORY.TRUE}
        ${filters}
      GROUP BY
        ${groupBy}
      ORDER BY
        ${orderBy}
    `
  }

  buildTotalStockOpnameComplianceQuery(
    c: Context,
    queryParams: StockOpnameQueryParams,
    isSummaryBox: boolean
  ) {
    const programId = c.var.programId ?? queryParams.program_id
    const { entityFilters } = this.#generateFilters(queryParams)

    const { entitySelect, groupBy, orderBy } = this.#generateClauses(
      queryParams,
      isSummaryBox
    )

    return `
      SELECT
        ${entitySelect},
        count(DISTINCT dwema.ema_entity_id) AS count 
      FROM 
        dim_ws_entity_material_activities dwema FINAL
      PREWHERE 
        dwema.program_id = ${programId}
        AND dwema.entity_is_vendor = ${ENTITY_IS_VENDOR.IS_VENDOR}
        AND dwema.entity_status = ${ENTITY_STATUS.ACTIVE}
        AND dwema.has_transaction_already = ${HAS_TRANSACTION_ALREADY.TRUE}
      WHERE 
        dwema.ema_deleted_at is null 
        AND dwema.entity_activity_start_date is not null 
        AND dwema.entity_type != ${ENTITY_TYPE.CENTER}
        AND dwema.material_is_stock_opname_mandatory = ${IS_SO_MANDATORY.TRUE}
        AND (
          (
            entity_activity_start_date <= {to:DateTime('Asia/Jakarta')} 
            AND entity_activity_end_date >= {to:DateTime('Asia/Jakarta')}
          ) 
          OR (
            entity_activity_end_date is null 
            AND entity_activity_start_date <= {to:DateTime('Asia/Jakarta')}
          )
        )
        ${entityFilters}
      GROUP BY ${groupBy}
      ORDER BY ${orderBy}
    `
  }

  buildStockOpnameResultQuery(
    c: Context,
    queryParams: StockOpnameQueryParams,
    isSummaryBox: boolean,
    isPaginate: boolean = false
  ) {
    const programId = c.var.programId ?? queryParams.program_id
    const {
      province_ids,
      regency_ids,
      entity_ids,
      entity_tag_ids,
      paginate,
      offset,
    } = queryParams
    const { filters } = this.#generateFilters(queryParams)

    let { select, groupBy, orderBy } = this.#generateClauses(
      queryParams,
      isSummaryBox
    )

    if (
      !isSummaryBox &&
      ((province_ids && regency_ids) || entity_ids || entity_tag_ids)
    ) {
      select += `,
        dso.entity_name as entity_name, 
        dso.province_name as province_name, 
        dso.regency_name as regency_name,
        dso.entity_tag_title as entity_tag_name
      `
      groupBy += ", entity_name, province_name, regency_name, entity_tag_name"
      orderBy += ", entity_name, province_name, regency_name, entity_tag_name"
    }

    const pagination =
      !isSummaryBox && isPaginate ? `LIMIT ${paginate} OFFSET ${offset}` : ""

    return `
      SELECT
        ${select},
        sum(dso.stock_opname_smile_qty) AS stock,
        sum(dso.ed_qty) AS exp_stock,
        sum(dso.stock_opname_unsubmit_distribution_qty) AS  stock_in_transit,
        sum(dso.stock_opname_real_qty) AS real_stock,
        abs(stock - real_stock) AS difference,
        (difference / stock) * 100 AS difference_percentage
      FROM datamart_stock_opname_v5 AS dso FINAL
      JOIN (
        SELECT
          rwea_inner.id,
          rwea_inner.entity_id,
          rwea_inner.activity_id
        FROM raw_ws_entity_activities AS rwea_inner FINAL
        WHERE
          rwea_inner.start_date is not null
          AND (
            (start_date <= {to:DateTime('Asia/Jakarta')} AND end_date >= {to:DateTime('Asia/Jakarta')})
            OR (end_date is null AND start_date <= {to:DateTime('Asia/Jakarta')})
          )
      ) AS rwea ON dso.entity_id = rwea.entity_id AND dso.stock_opname_activity_id = rwea.activity_id
      PREWHERE dso.stock_opname_updated_at BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')} 
      AND dso.stock_opname_program_id = ${programId}
      WHERE
        dso.so_within_period = ${SO_STATUS.DONE}
        AND dso.stock_opname_deleted_at is null
        ${filters}
      GROUP BY ${groupBy}
      ORDER BY ${orderBy}
      ${pagination}
    `
  }

  buildStockOpnameMaterialQuery(
    c: Context,
    queryParams: StockOpnameQueryParams
  ) {
    const programId = c.var.programId ?? queryParams.program_id
    const { filters } = this.#generateFilters(queryParams)
    const {
      entity_ids,
      entity_tag_ids,
      province_ids,
      regency_ids,
      material_ids,
      material_level_id,
    } = queryParams

    let locationSelect = ""
    if (
      entity_ids ||
      (Array.isArray(entity_tag_ids) && entity_tag_ids.length > 0)
    ) {
      locationSelect = "dso.entity_id AS location_id"
    } else if (province_ids && regency_ids) {
      locationSelect = "dso.entity_id AS location_id"
    } else if (province_ids && !regency_ids) {
      locationSelect = "dso.regency_id AS location_id"
    } else {
      locationSelect = "dso.province_id AS location_id"
    }

    let materialSelect = ""
    if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.TEMPLATE
    ) {
      materialSelect = "dso.stock_opname_parent_material_id AS material_id"
    } else if (
      material_ids &&
      material_level_id &&
      material_level_id === KFA_LEVEL_CODE.VARIANT
    ) {
      materialSelect = "dso.stock_opname_material_id AS material_id"
    }

    return `
      SELECT
        ${locationSelect},
        ${materialSelect},
        sum(dso.stock_opname_smile_qty) AS smile_qty,
        sum(dso.stock_opname_real_qty) AS real_qty
      FROM datamart_stock_opname_v5 AS dso FINAL
      JOIN (
        SELECT
          rwea_inner.id,
          rwea_inner.entity_id,
          rwea_inner.activity_id
        FROM raw_ws_entity_activities AS rwea_inner FINAL
        WHERE
          rwea_inner.start_date is not null
          AND (
            (start_date <= {to:DateTime('Asia/Jakarta')} AND end_date >= {to:DateTime('Asia/Jakarta')})
            OR (end_date is null AND start_date <= {to:DateTime('Asia/Jakarta')})
          )
      ) AS rwea ON dso.entity_id = rwea.entity_id AND dso.stock_opname_activity_id = rwea.activity_id
      PREWHERE dso.stock_opname_updated_at BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')} 
      AND dso.stock_opname_program_id = ${programId}
      WHERE
        dso.so_within_period = ${SO_STATUS.DONE}
        AND dso.stock_opname_deleted_at is null
        ${filters}
      GROUP BY
        location_id,
        material_id
    `
  }
}
