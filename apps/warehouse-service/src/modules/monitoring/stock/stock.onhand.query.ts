import { Context } from "hono"
import { MonitoringStockSchemaQueryParams } from "./stock.schema.js"
import { ENTITY_TYPE } from "@/common/constants/entity.js"

export class MonitoringStockOnHandQuery {
  static queryCTE(c: Context, condition: string = "") {
    const query = `
    select 
        max(transactions_id)
    from datamart_transactions_v5 s FINAL
    prewhere s.program_id = ${c.var.programId} AND toDate(s.transactions_created_at + interval 7 hours) between {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}
    where s.entities_is_vendor = 1
    and entities_type <> ${ENTITY_TYPE.CENTER}
    and (
        (join_date <= {to:DateTime('Asia/Jakarta')} and end_date >= {to:DateTime('Asia/Jakarta')})
        or (end_date is null and join_date <= {to:DateTime('Asia/Jakarta')})
    )
    and transactions_deleted_at is null
    and master_deleted_at is null
    ${condition}
    group by transactions_stock_id

    `
    return query.trim()
  }

  queryChart(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams,
    condition: string = ""
  ) {
    const query = `
    select
        ${queryParams.kfaMaterial?.columnId}
        , ${queryParams.kfaMaterial?.columnName}
        , entity_tags_id as entity_tag_id
        , entity_tags_title as entity_tag_title
        , toMonth(transactions_created_at + interval 7 hours) as month
        , toYear(transactions_created_at + interval 7 hours) as year
        , toMonth(expired_date) as exp_month
        , toYear(expired_date) as exp_year
        , SUM(
          (CASE
            WHEN transactions_transaction_type_id = 1 THEN transactions_change_qty
            ELSE transactions_opening_qty + transactions_change_qty
          END)
        ) as qty
    from datamart_transactions_v5 s FINAL
    ${queryParams.kfaMaterial?.joinTable}
    where transactions_id in (${MonitoringStockOnHandQuery.queryCTE(c, condition)})
    group by 1,2,3,4,5,6,7,8
    order by year asc, month asc, qty desc
    `
    return query.trim()
  }

  queryEntity(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams,
    condition: string = ""
  ) {
    const query = `
    select
        entities_id as entity_id
        , entities_name as entity_name
        , entities_province_id as province_id
        , entities_province_name as province_name
        , entities_regency_id as regency_id
        , entities_regency_name as regency_name
        , SUM(
          (CASE
            WHEN transactions_transaction_type_id = 1 THEN transactions_change_qty
            ELSE transactions_opening_qty + transactions_change_qty
          END)
        ) as qty
    from datamart_transactions_v5 s FINAL
    ${queryParams.kfaMaterial?.joinTable}
    where transactions_id in (${MonitoringStockOnHandQuery.queryCTE(c, condition)})
    group by 1,2,3,4,5,6
    ${queryParams.kfaMaterial?.orderBy}
    `
    return query.trim()
  }

  queryEntityMaterial(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams,
    condition: string = ""
  ) {
    const query = `
    select
        entities_id as entity_id
        , entities_name as entity_name
        , entities_province_id as province_id
        , entities_province_name as province_name
        , entities_regency_id as regency_id
        , entities_regency_name as regency_name
        , ${queryParams.kfaMaterial?.columnId}
        , ${queryParams.kfaMaterial?.columnName}
        , dmm_unit_of_consumption_name as master_materials_unit
        , SUM(DISTINCT ema_min) as min
        , SUM(DISTINCT ema_max) as max
        , SUM(
          (CASE
            WHEN transactions_transaction_type_id = 1 THEN transactions_change_qty
            ELSE transactions_opening_qty + transactions_change_qty
          END)
        ) as qty
    from datamart_transactions_v5 s FINAL
    ${queryParams.kfaMaterial?.joinTable ?? " "}
    where transactions_id in (${MonitoringStockOnHandQuery.queryCTE(c, condition)})
    group by 1,2,3,4,5,6,7,8,9
    ${queryParams.kfaMaterial?.orderBy}
    `
    return query.trim()
  }

  queryEntityStock(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams,
    condition: string = ""
  ) {
    const query = `
    select
        entities_id as entity_id
        , entities_name as entity_name
        , entities_province_id as province_id
        , entities_province_name as province_name
        , entities_regency_id as regency_id
        , entities_regency_name as regency_name
        , entity_tags_id as entity_tag_id
        , entity_tags_title as entity_tag_title
        , s.entities_id_satu_sehat as id_satu_sehat
        , stock_activity_id as activity_id
        , stock_activity_name as activity_name
        , ${queryParams.kfaMaterial?.columnId ?? " "}
        , ${queryParams.kfaMaterial?.columnName ?? " "}
        , s.dmm_code as master_materials_code
        , s.dmm_hierarchy_code as master_materials_kfa_code
        , batches_code
        , expired_date
        , SUM(
          (CASE
            WHEN transactions_transaction_type_id = 1 THEN transactions_change_qty
            ELSE transactions_opening_qty + transactions_change_qty
          END)
        ) as qty
    from datamart_transactions_v5 s FINAL
    ${queryParams.kfaMaterial?.joinTable ?? " "}
    where transactions_id in (${MonitoringStockOnHandQuery.queryCTE(c, condition)})
    group by 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17
    ${queryParams.kfaMaterial?.orderBy}
    `
    return query.trim()
  }

  queryProvince(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams,
    condition: string = ""
  ) {
    const query = `
    select
        entities_province_id as province_id
        , entities_province_name as province_name
        , SUM(
          (CASE
            WHEN transactions_transaction_type_id = 1 THEN transactions_change_qty
            ELSE transactions_opening_qty + transactions_change_qty
          END)
        ) as qty
    from datamart_transactions_v5 s FINAL
    ${queryParams.kfaMaterial?.joinTable ?? " "}
    where transactions_id in (${MonitoringStockOnHandQuery.queryCTE(c, condition)})
    group by 1,2
    ${queryParams.kfaMaterial?.orderBy}
    `
    return query.trim()
  }

  queryRegency(
    c: Context,
    queryParams: MonitoringStockSchemaQueryParams,
    condition: string = ""
  ) {
    const query = `
    SELECT
      entities_regency_id AS regency_id,
      entities_regency_name AS regency_name,
      SUM(
        CASE
          WHEN transactions_transaction_type_id = 1 THEN transactions_change_qty
          ELSE transactions_opening_qty + transactions_change_qty
        END
      ) AS qty
    FROM datamart_transactions_v5 s FINAL
    ${queryParams.kfaMaterial?.joinTable ?? " "}
    WHERE transactions_id in (${MonitoringStockOnHandQuery.queryCTE(c, condition)})
    GROUP BY 1,2
    ${queryParams.kfaMaterial?.orderBy}
    `
    return query.trim()
  }
}
