import { Context } from "hono"
import { MonitoringStockSchemaQueryParams } from "./stock.schema.js"

export class MonitoringStockInTransitQuery {
  static queryWhereClause(c: Context, condition: string = "") {
    const query = `
    prewhere s.program_id = ${c.var.programId} AND toDate(s.transactions_created_at + interval 7 HOUR) BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}
    WHERE transactions_transaction_type_id = 2
    AND orders_order_status_id = 4
    AND orders_order_type_id IN (1, 2, 3)
    AND (
      (join_date <= {to:DateTime('Asia/Jakarta')} AND end_date >= {to:DateTime('Asia/Jakarta')})
      OR (end_date IS NULL AND join_date <= {to:DateTime('Asia/Jakarta')})
    )
    AND transactions_deleted_at IS NULL
    AND master_deleted_at IS NULL
    ${condition}
    `
    return query.trim()
  }

  static queryFROM(programId: number) {
    const query = `
    FROM datamart_transactions_v5 s FINAL
    JOIN raw_ws_entities ec FINAL ON ec.id = transactions_customer_id AND ec.is_vendor = 1 AND ec.deleted_at IS NULL AND ec.program_id = ${programId}
    JOIN raw_entity_tags et FINAL ON ec.entity_tag_id = et.id 
    LEFT JOIN raw_locations lp FINAL ON toInt64(ec.province_id) = lp.id AND lp.level = 0
    LEFT JOIN raw_locations lr FINAL ON toInt64(ec.regency_id) = lr.id AND lr.level = 1
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
      , ec.entity_tag_id as entity_tag_id
      , et.title as entity_tag_title
      , toMonth(transactions_created_at + interval 7 hours) as month
      , toYear(transactions_created_at + interval 7 hours) as year
      , toMonth(expired_date) as exp_month
      , toYear(expired_date) as exp_year
      , SUM(abs(transactions_change_qty)) as qty
    ${MonitoringStockInTransitQuery.queryFROM(c.var.programId)}
    ${queryParams.kfaMaterial?.joinTable}
    ${MonitoringStockInTransitQuery.queryWhereClause(c, condition)}
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
      transactions_customer_id as entity_id
      , ec.name as entity_name
      , lp.id as province_id
      , lp.name as province_name
      , lr.id as regency_id
      , lr.name as regency_name
      , SUM(abs(transactions_change_qty)) as qty
    ${MonitoringStockInTransitQuery.queryFROM(c.var.programId)}
    ${queryParams.kfaMaterial?.joinTable ?? " "}
    ${MonitoringStockInTransitQuery.queryWhereClause(c, condition)}
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
      transactions_customer_id as entity_id
      , ec.name as entity_name
      , lp.id as province_id
      , lp.name as province_name
      , lr.id as regency_id
      , lr.name as regency_name
      , ${queryParams.kfaMaterial?.columnId}
      , ${queryParams.kfaMaterial?.columnName}
      , dmm_unit_of_consumption_name as master_materials_unit
      , SUM(abs(transactions_change_qty)) as qty
      , SUM(DISTINCT ema_min) as min
      , SUM(DISTINCT ema_max) as max
    ${MonitoringStockInTransitQuery.queryFROM(c.var.programId)}
    ${queryParams.kfaMaterial?.joinTable}
    ${MonitoringStockInTransitQuery.queryWhereClause(c, condition)}
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
      transactions_customer_id as entity_id
      , ec.name as entity_name
      , lp.id as province_id
      , lp.name as province_name
      , lr.id as regency_id
      , lr.name as regency_name
      , ec.entity_tag_id as entity_tag_id
      , et.title as entity_tag_title
      , s.entities_id_satu_sehat as id_satu_sehat
      , stock_activity_id as activity_id
      , stock_activity_name as activity_name
      , ${queryParams.kfaMaterial?.columnId}
      , ${queryParams.kfaMaterial?.columnName}
      , s.dmm_code as master_materials_code
      , s.dmm_hierarchy_code as master_materials_kfa_code
      , batches_code
      , expired_date
      , SUM(abs(transactions_change_qty)) as qty
    ${MonitoringStockInTransitQuery.queryFROM(c.var.programId)}
    ${queryParams.kfaMaterial?.joinTable}
    ${MonitoringStockInTransitQuery.queryWhereClause(c, condition)}
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
      lp.id as province_id
      , lp.name as province_name
      , SUM(abs(transactions_change_qty)) as qty
    ${MonitoringStockInTransitQuery.queryFROM(c.var.programId)}
    ${queryParams.kfaMaterial?.joinTable ?? " "}
    ${MonitoringStockInTransitQuery.queryWhereClause(c, condition)}
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
    select
      lr.id as regency_id
      , lr.name as regency_name
      , SUM(abs(transactions_change_qty)) as qty
    ${MonitoringStockInTransitQuery.queryFROM(c.var.programId)}
    ${queryParams.kfaMaterial?.joinTable ?? " "}
    ${MonitoringStockInTransitQuery.queryWhereClause(c, condition)}
    group by 1,2
    ${queryParams.kfaMaterial?.orderBy}
    `
    return query.trim()
  }
}
