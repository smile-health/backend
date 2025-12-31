import {
  ENTITY_IS_VENDOR,
  ENTITY_STATUS,
  ENTITY_TYPE,
} from "@/common/constants/entity.js"
import { UserActivityQueryParams } from "./user-activity.schema.js"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { Context } from "hono"

export class UserActivityQuery {
  #generateEntityFilters(queryParams: UserActivityQueryParams) {
    let entityFilters = ""
    entityFilters += queryParams.entity_id
      ? ` AND dwema.ema_entity_id = {entity_id:Int64}`
      : ""
    entityFilters += queryParams.customer_id
      ? ` AND dwema.customer_id = {customer_id:Int64}`
      : ""
    entityFilters +=
      queryParams.entity_tag_ids && queryParams.entity_tag_ids.length > 0
        ? ` AND dwema.entity_tag_id in {entity_tag_ids:Array(Int64)}`
        : ""
    entityFilters += queryParams.customer_entity_tag_id
      ? ` AND dwema.customer_entity_tag_id = {customer_entity_tag_id:Int64}`
      : ""
    entityFilters +=
      queryParams.province_id != undefined
        ? ` AND toInt64(dwema.entity_province_id) = {province_id:Int}`
        : ""
    entityFilters +=
      queryParams.regency_id != undefined
        ? ` AND toInt64(dwema.entity_regency_id) = {regency_id:Int}`
        : ""

    return entityFilters
  }

  #generateCustomerFilters(queryParams: UserActivityQueryParams) {
    let entityFilters = ""
    entityFilters += queryParams.entity_id
      ? ` AND dwcs.vendor_id = {entity_id:Int64}`
      : ""
    entityFilters += queryParams.customer_id
      ? ` AND dwcs.customer_id = {customer_id:Int64}`
      : ""
    entityFilters +=
      queryParams.entity_tag_ids && queryParams.entity_tag_ids.length > 0
        ? ` AND dwcs.vendor_tag_id in {entity_tag_ids:Array(Int64)}`
        : ""
    entityFilters +=
      queryParams.customer_tag_ids && queryParams.customer_tag_ids.length > 0
        ? ` AND dwcs.customer_tag_id in {customer_tag_ids:Array(Int64)}`
        : ""
    entityFilters +=
      queryParams.province_id != undefined
        ? ` AND toInt64(dwcs.customer_province_id) = {province_id:Int}`
        : ""
    entityFilters +=
      queryParams.regency_id != undefined
        ? ` AND toInt64(dwcs.customer_regency_id) = {regency_id:Int}`
        : ""

    return entityFilters
  }

  queryActivityAll(queryParams: UserActivityQueryParams["activity_ids"]) {
    const activityIds =
      queryParams && queryParams.length > 0
        ? " AND dma.id IN {activity_ids:Array(Int64)} "
        : ""
    return `
    select 
      dma.id as activity_id, 
      dma.name as activity_name
    from
      raw_ws_activities dma FINAL
    where
      dma.deleted_at is null
      AND dma.program_id = {program_id:Int}
      ${activityIds}
    `.trim()
  }

  queryCalculateEntityForActivity(condition: string = "") {
    return `
    SELECT 
      distinct dt.entities_id AS entity_id
    FROM 
      datamart_transactions_v5 dt FINAL
      INNER JOIN (
        SELECT 
          dead_inner.id, 
          dead_inner.entity_id, 
          dead_inner.activity_id 
        FROM 
          raw_ws_entity_activities AS dead_inner FINAL
          -- dim_entity_activity_date AS dead_inner
        WHERE 
          (dead_inner.start_date IS NOT NULL) 
          AND (
            (
              (
                dead_inner.start_date <= {current_date:Date}
              ) 
              AND (
                dead_inner.end_date >= {current_date:Date}
              )
            ) 
            OR (
              (dead_inner.end_date IS NULL) 
              AND (
                dead_inner.start_date <= {current_date:Date}
              )
            )
          )
      ) AS dead ON (dead.entity_id = dt.entities_id) 
      AND (
        dead.activity_id = dt.transactions_activity_id
      )
    LEFT JOIN raw_material_types mt ON mt.name = dt.material_type_name
    PREWHERE dt.program_id = {program_id:Int} AND toDate(transactions_created_at + interval 7 hours) between {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}
    WHERE 
      (
        dt.transactions_deleted_at IS NULL
      )
      AND ( dt.transactions_transaction_type_id in {transaction_type:Array(Int64)} )
      AND dt.master_deleted_at is null
      ${condition}
    `.trim()
  }

  queryActivityDates(condition: string = "") {
    return `
    SELECT 
      toDate(
        toDateTime(
          dt.transactions_created_at, 
          'Asia/Jakarta'
        )
      ) AS date, 
      dt.entities_id AS entity_id, 
      count(
        toDateTime(
          dt.transactions_created_at, 'Asia/Jakarta'
        )
      ) AS active_transaction 
    FROM 
      datamart_transactions_v5 dt FINAL
      INNER JOIN (
        SELECT 
          dead_inner.id, 
          dead_inner.entity_id, 
          dead_inner.activity_id 
        FROM 
          raw_ws_entity_activities AS dead_inner FINAL
          -- dim_entity_activity_date AS dead_inner
        WHERE 
          (dead_inner.start_date IS NOT NULL) 
          AND (
            (
              (
                dead_inner.start_date <= {current_date:Date}
              ) 
              AND (
                dead_inner.end_date >= {current_date:Date}
              )
            ) 
            OR (
              (dead_inner.end_date IS NULL) 
              AND (
                dead_inner.start_date <= {current_date:Date}
              )
            )
          )
      ) AS dead ON (dead.entity_id = dt.entities_id) 
      AND (
        dead.activity_id = dt.transactions_activity_id
      )
    LEFT JOIN raw_material_types mt ON mt.name = dt.material_type_name
    PREWHERE dt.program_id = {program_id:Int} AND toDate(transactions_created_at + interval 7 hours) between {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}
    WHERE 
      (
        dt.transactions_deleted_at IS NULL
      )
      AND ( dt.transactions_transaction_type_id in {transaction_type:Array(Int64)} )
      AND dt.master_deleted_at is null
      ${condition}
    GROUP BY 
      date, 
      dt.entities_id
    `.trim()
  }

  queryOverview(queryParams: UserActivityQueryParams, condition: string = "") {
    const entityFilters = this.#generateEntityFilters(queryParams)

    return `
      select
        100*count(t.entity_id)/count(e.id) as pct_active_entity
        , 100*(count(e.id) - count(t.entity_id))/count(e.id) as pct_non_active_entity
        , count(t.entity_id) as active_entity
        , count(e.id) - count(t.entity_id) as non_active_entity
        , count(e.id) as total_entity
      from (
        SELECT
          DISTINCT dwema.ema_entity_id as id
        FROM 
          dim_ws_entity_material_activities dwema FINAL
        PREWHERE 
          dwema.program_id = {program_id:Int64}
          AND dwema.entity_is_vendor = ${ENTITY_IS_VENDOR.IS_VENDOR}
          AND dwema.entity_status = ${ENTITY_STATUS.ACTIVE}
        WHERE 
          dwema.ema_deleted_at is null 
          AND dwema.entity_activity_start_date is not null 
          AND dwema.entity_type != ${ENTITY_TYPE.CENTER}
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
          ${entityFilters}
      ) e
      left join (
        select distinct
          entities_id as entity_id
          , entities_name as entity_name
        from datamart_transactions_v5 dt FINAL
        PREWHERE dt.program_id = {program_id:Int} and dt.transactions_created_at between {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}
        where master_deleted_at is null
        and transactions_deleted_at is null
        and (
            (join_date <= {to:DateTime('Asia/Jakarta')} and end_date >= {to:DateTime('Asia/Jakarta')})
            or (end_date is null and join_date <= {to:DateTime('Asia/Jakarta')})
        )
        and entities_is_vendor = 1
        and entities_type != ${ENTITY_TYPE.CENTER}
        and entities_status = 1
        and dt.transactions_transaction_type_id in {transaction_type:Array(Int64)}
        ${condition}
      ) t on t.entity_id = e.id
      `.trim()
  }

  #generateEntityClauses(
    queryParams: UserActivityQueryParams,
    paginationOption: PaginationOption
  ) {
    const { paginate, offset } = queryParams
    const { is_paginate, count } = paginationOption

    let pagination = `LIMIT ${paginate} OFFSET ${offset}`
    let orderBy = `ORDER BY dwema.ema_entity_id`
    let select = `
      DISTINCT
        dwema.ema_entity_id as entity_id,
        dwema.entity_name as entity_name,
        dwema.entity_province_name as province_name,
        dwema.entity_regency_name as regency_name
    `
    if (count === true) {
      // Count
      pagination = ""
      orderBy = ""
      select = `COUNT(
        DISTINCT
          dwema.ema_entity_id,
          dwema.entity_name,
          dwema.entity_province_name,
          dwema.entity_regency_name
      ) as count`
    } else if (is_paginate === false && count === false) {
      // Export Excel
      pagination = ""
    }

    return { pagination, orderBy, select }
  }

  #generateCustomerClauses(
    queryParams: UserActivityQueryParams,
    paginationOption: PaginationOption
  ) {
    const { paginate, offset } = queryParams
    const { is_paginate, count } = paginationOption

    let pagination = `LIMIT ${paginate} OFFSET ${offset}`
    let orderBy = `ORDER BY dwcs.customer_id`
    let select = `
      DISTINCT
        dwcs.vendor_id as entity_id,
        dwcs.vendor_name as entity_name,
        dwcs.customer_id as customer_id,
        dwcs.customer_name as customer_name,
        dwcs.customer_province_name as province_name,
        dwcs.customer_regency_name as regency_name
    `
    if (count === true) {
      // Count
      pagination = ""
      orderBy = ""
      select = `COUNT(
        DISTINCT
          dwcs.vendor_id,
          dwcs.vendor_name,
          dwcs.customer_id,
          dwcs.customer_name,
          dwcs.customer_province_name,
          dwcs.customer_regency_name
      ) as count`
    } else if (is_paginate === false && count === false) {
      // Export Excel
      pagination = ""
    }

    return { pagination, orderBy, select }
  }

  buildEntityQuery(
    c: Context,
    queryParams: UserActivityQueryParams,
    paginationOption: PaginationOption = {}
  ) {
    const entityFilters = this.#generateEntityFilters(queryParams)
    const { pagination, orderBy, select } = this.#generateEntityClauses(
      queryParams,
      paginationOption
    )

    const query = `
      SELECT 
        ${select}
      FROM 
        dim_ws_entity_material_activities dwema FINAL
      PREWHERE 
        dwema.program_id = {program_id:Int64}
        AND dwema.entity_is_vendor = ${ENTITY_IS_VENDOR.IS_VENDOR}
        AND dwema.entity_status = ${ENTITY_STATUS.ACTIVE}        
      WHERE 
        dwema.ema_deleted_at is null 
        AND dwema.entity_activity_start_date is not null 
        AND dwema.entity_type != ${ENTITY_TYPE.CENTER}
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
        ${entityFilters}
      ${orderBy}
      ${pagination}
    `
    return query
  }

  buildCustomerQuery(
    c: Context,
    queryParams: UserActivityQueryParams,
    paginationOption: PaginationOption = {}
  ) {
    const customerFilters = this.#generateCustomerFilters(queryParams)
    const { pagination, orderBy, select } = this.#generateCustomerClauses(
      queryParams,
      paginationOption
    )

    const query = `
      SELECT 
        ${select}
      FROM 
        dim_ws_customer_vendors dwcs FINAL
      PREWHERE dwcs.program_id = {program_id:Int64}
      WHERE 
        dwcs.deleted_at is null 
        AND dwcs.is_consumption = 1
        AND dwcs.customer_status = ${ENTITY_STATUS.ACTIVE}
        AND dwcs.customer_type_id != ${ENTITY_TYPE.CENTER}
        AND dwcs.vendor_start_date is not null 
        AND (
          (
            dwcs.vendor_start_date <= {to:DateTime('Asia/Jakarta')} 
            AND dwcs.vendor_end_date >= {to:DateTime('Asia/Jakarta')}
          ) 
          OR (
            dwcs.vendor_end_date is null 
            AND dwcs.vendor_start_date <= {to:DateTime('Asia/Jakarta')}
          )
        )
        ${customerFilters}
      ${orderBy}
      ${pagination}
    `
    return query
  }
}
