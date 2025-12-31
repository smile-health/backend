import { Context } from "hono"
import { MonitoringTransactionSchemaQueryParams } from "./transaction.schema.js"

export class MonitoringTransactionQuery {
  static queryAggregation(
    queryParams: MonitoringTransactionSchemaQueryParams["transactionQuery"]
  ) {
    // return `
    //   sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id IN (2,5) AND transactions_order_id IS NULL) AS value_consumption,
    //   sum(transactions_change_qty) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id = 5) AS value_acceptance,
    //   sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id IN (4,5)) AS value_distribution,
    //   sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id IN (4,5)) AS value_returning,
    //   sum(transactions_change_qty * -1) FILTER (WHERE transactions_transaction_type_id IN (4,11)) AS value_discarding,
    //   sum(transactions_change_qty) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id = 5) AS value_acceptance_returning,
    //   count(transactions_id) FILTER (WHERE transactions_transaction_type_id IN (2,5) AND transactions_order_id IS NULL) AS count_consumption,
    //   count(transactions_id) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id = 5) AS count_acceptance,
    //   count(transactions_id) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id IN (1,2,4) AND orders_order_status_id IN (4,5)) AS count_distribution,
    //   count(transactions_id) FILTER (WHERE transactions_transaction_type_id = 2 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id IN (4,5)) AS count_returning,
    //   count(transactions_id) FILTER (WHERE transactions_transaction_type_id IN (4,11)) AS count_discarding,
    //   count(transactions_id) FILTER (WHERE transactions_transaction_type_id = 3 AND transactions_order_id IS NOT NULL AND orders_order_type_id = 3 AND orders_order_status_id = 5) AS count_acceptance_returning
    // `.trim()
    return `
    ${queryParams?.column?.join(",")}
    `
  }

  static queryFromJoin() {
    return `
      FROM datamart_monitoring_transactions_v5 t FINAL
    `.trim()
  }

  static queryWhereClause(condition: string = "") {
    return `
      prewhere toDate(t.transactions_created_at + interval 7 hour) BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}
      WHERE transactions_deleted_at IS NULL
      AND master_deleted_at IS NULL
      AND t.entities_id IS NOT NULL
      AND entities_is_vendor = 1
      AND entities_status = 1
      AND (
        (join_date <= {to:DateTime('Asia/Jakarta')} AND end_date >= {to:DateTime('Asia/Jakarta')})
        OR (end_date IS NULL AND join_date <= {to:DateTime('Asia/Jakarta')})
      )
      ${condition}
    `.trim()
  }

  queryChart(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams,
    condition: string = ""
  ) {
    return `
    SELECT
    formatDateTime(transactions_created_at + interval 7 hour, '%Y') as year,
    formatDateTime(transactions_created_at + interval 7 hour, '%Y-%m') as month,
    entity_tags_id as entity_tag_id,
    entity_tags_title as entity_tag_title,
    CASE 
        WHEN t.transactions_transaction_type_id = 2 AND t.orders_order_type_id IN (1,2,4) AND t.orders_order_status_id IN (4,5) AND t.transactions_order_id IS NOT NULL THEN 2
        WHEN t.transactions_transaction_type_id = 3 AND t.orders_order_type_id IN (1,2,4) AND t.orders_order_status_id = 5 THEN 3
        WHEN t.transactions_transaction_type_id IN (4,9) THEN 4
        WHEN t.transactions_transaction_type_id = 3 AND t.orders_order_type_id = 3 AND t.orders_order_status_id = 5 THEN 101
        WHEN t.transactions_transaction_type_id = 2 AND t.orders_order_type_id = 3 AND t.orders_order_status_id IN (4,5) THEN 102
        WHEN t.transactions_transaction_type_id IN (10,5) AND t.transactions_order_id IS NULL THEN 103
        WHEN t.transactions_transaction_type_id = 7 THEN 7
        WHEN t.transactions_transaction_type_id = 8 THEN 8
        ELSE NULL
      END as transaction_type_id,
    count(t.transactions_id) as count,
    abs(sum(t.transactions_change_qty)) as value
    ${MonitoringTransactionQuery.queryFromJoin()}
    ${MonitoringTransactionQuery.queryWhereClause(condition)}
    GROUP BY 1,2,3,4,5
    ${queryParams.transactionQuery?.orderBy ? `ORDER BY ${queryParams.transactionQuery?.orderBy}` : ""}
    `.trim()
  }

  queryChartOld(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams,
    condition: string = ""
  ) {
    return `
    SELECT
    toYear(transactions_created_at + interval 7 hour) as year
    , toMonth(transactions_created_at + interval 7 hour) as month
    , entity_tags_id as entity_tag_id
    , entity_tags_title as entity_tag_title,
    ${MonitoringTransactionQuery.queryAggregation(queryParams.transactionQuery)}
    ${MonitoringTransactionQuery.queryFromJoin()}
    ${MonitoringTransactionQuery.queryWhereClause(condition)}
    GROUP BY 1,2,3,4
    ${queryParams.transactionQuery?.orderBy ? `ORDER BY ${queryParams.transactionQuery?.orderBy}` : ""}
    `.trim()
  }

  queryProvince(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams,
    condition: string = ""
  ) {
    return `
    SELECT
    entities_province_id as province_id, entities_province_name as province_name,
    ${MonitoringTransactionQuery.queryAggregation(queryParams.transactionQuery)}
    ${MonitoringTransactionQuery.queryFromJoin()}
    ${MonitoringTransactionQuery.queryWhereClause(condition)}
    GROUP BY 1,2
    ${queryParams.transactionQuery?.orderBy ? `ORDER BY ${queryParams.transactionQuery?.orderBy}` : ""}
    `.trim()
  }
  queryRegency(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams,
    condition: string = ""
  ) {
    return `
    SELECT
    entities_regency_id as regency_id, entities_regency_name as regency_name,
    ${MonitoringTransactionQuery.queryAggregation(queryParams.transactionQuery)}
    ${MonitoringTransactionQuery.queryFromJoin()}
    ${MonitoringTransactionQuery.queryWhereClause(condition)}
    GROUP BY 1,2
    ${queryParams.transactionQuery?.orderBy ? `ORDER BY ${queryParams.transactionQuery?.orderBy}` : ""}
    `.trim()
  }
  queryEntity(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams,
    condition: string = "",
    withPagination: boolean = true,
    isCount: boolean = false
  ) {
    const baseQuery = `
    SELECT
    entities_id as entity_id
    , entities_name as entity_name
    , entities_province_id as province_id
    , entities_province_name as province_name
    , entities_regency_id as regency_id
    , entities_regency_name as regency_name, 
    ${MonitoringTransactionQuery.queryAggregation(queryParams.transactionQuery)}
    ${MonitoringTransactionQuery.queryFromJoin()}
    ${MonitoringTransactionQuery.queryWhereClause(condition)}
    GROUP BY 1,2,3,4,5,6
    `.trim()

    if (isCount) {
      return `SELECT COUNT(*) as total FROM (${baseQuery})`
    }

    const paginationClause =
      withPagination && queryParams.paginate && queryParams.offset !== undefined
        ? `LIMIT ${queryParams.paginate} OFFSET ${queryParams.offset}`
        : ""

    return `
    ${baseQuery}
    ${queryParams.transactionQuery?.orderBy ? `ORDER BY ${queryParams.transactionQuery?.orderBy}` : ""}
    ${paginationClause}
    `.trim()
  }
  queryEntityComplete(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams,
    condition: string = "",
    withPagination: boolean = true,
    isCount: boolean = false
  ) {
    const baseQuery = `
    SELECT
    entities_id as entity_id
    , entities_name as entity_name
    , entities_province_id as province_id
    , entities_province_name as province_name
    , entities_regency_id as regency_id
    , entities_regency_name as regency_name
    , transactions_master_material_id as material_id
    , dmm_name as material_name
    , dmm_unit_of_consumption_name as material_unit
    ${queryParams.transactionQuery?.columnJoinTable ?? ""}
    , batches_code as batch_code
    , batches_id as batch_id
    , t.expired_date as expired_date
    , manufacture_id AS manufacture_id
    , manufacture_name AS manufacture_name
    , transactions_vendor_id AS vendor_id
    , vendor_name AS vendor_name 
    , transactions_activity_name as activity_name
    , customer_province_id AS customer_province_id
    , customer_province_name AS customer_province_name
    , customer_regency_id AS customer_regency_id
    , customer_regency_name AS customer_regency_name  
    , transactions_customer_id AS customer_id
    , customer_name as customer_name
    , transactions_created_at as created_at
    , transactions_transaction_type_id as transaction_type_id
    , transactions_transaction_type_name AS transaction_type_name
    , transactions_transaction_reason_id as transaction_reason_id
    , transactions_transaction_reason_name AS transaction_reason_name,
    ${MonitoringTransactionQuery.queryAggregation(queryParams.transactionQuery)}
    ${MonitoringTransactionQuery.queryFromJoin()}
    ${queryParams.transactionQuery?.joinTable ?? ""}
    ${MonitoringTransactionQuery.queryWhereClause(condition)}
    ${queryParams.transactionQuery?.groupBy ?? ""}
    `.trim()

    if (isCount) {
      return `SELECT COUNT(*) as total FROM (${baseQuery})`
    }

    const paginationClause =
      withPagination && queryParams.paginate && queryParams.offset !== undefined
        ? `LIMIT ${queryParams.paginate} OFFSET ${queryParams.offset}`
        : ""

    return `
    ${baseQuery}
    ${queryParams.transactionQuery?.orderBy ? `ORDER BY ${queryParams.transactionQuery?.orderBy}` : ""}
    ${paginationClause}
    `.trim()
  }
  queryMaterial(
    c: Context,
    queryParams: MonitoringTransactionSchemaQueryParams,
    condition: string = ""
  ) {
    return `
    SELECT
    transactions_master_material_id as material_id
    , dmm_name as material_name
    , dmm_unit_of_consumption_name as material_unit
    ${queryParams.material_level_id == 2 ? `${queryParams.transactionQuery?.columnJoinTable},` : ","}
    ${MonitoringTransactionQuery.queryAggregation(queryParams.transactionQuery)}
    ${MonitoringTransactionQuery.queryFromJoin()}
    ${queryParams.transactionQuery?.joinTable ?? ""}
    ${MonitoringTransactionQuery.queryWhereClause(condition)}
    ${queryParams.material_level_id == 2 ? "GROUP BY 1,2,3,4,5" : "GROUP BY 1,2,3"}
    ${queryParams.transactionQuery?.orderBy ? `ORDER BY ${queryParams.transactionQuery?.orderBy}` : ""}
    `.trim()
  }

  queryTransactionReason(condition: string = "") {
    return `
        select 
          t.transactions_transaction_reason_id as reason_id
          , tr.title as reason_name
          , count(transactions_id) as count
          , coalesce(sum(transactions_change_qty*-1) filter(where transactions_transaction_type_id = 4),0) 
            - coalesce(sum(transactions_change_qty) filter(where transactions_transaction_type_id = 11),0) as value
        from datamart_monitoring_transactions_v5 t
        join raw_ws_transaction_reasons tr on tr.id = t.transactions_transaction_reason_id
          and tr.deleted_at is null
        where transactions_transaction_type_id in (4,11)
        and entities_status = 1
        and entities_is_vendor = 1
        and (
            (join_date <= {to:DateTime('Asia/Jakarta')} and end_date >= {to:DateTime('Asia/Jakarta')})
            or (end_date is null and join_date <= {to:DateTime('Asia/Jakarta')})
        )
        and transactions_deleted_at is null
        and master_deleted_at is null
        and toDate(t.transactions_created_at + interval 7 hour)
        BETWEEN {from:DateTime('Asia/Jakarta')} AND {to:DateTime('Asia/Jakarta')}
        ${condition}
        group by 1,2
        order by 4 desc
    `.trim()
  }
}
