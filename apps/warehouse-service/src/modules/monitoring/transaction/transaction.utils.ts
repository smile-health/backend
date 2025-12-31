import { Context } from "hono"
import {
  MonitoringTransactionChartCategoriesDTO,
  MonitoringTransactionChartDatasetDTO,
  MonitoringTransactionDTO,
  MonitoringTransactionSchemaQueryParams,
} from "./transaction.schema.js"
import { SeriesConfig } from "@/common/schemas/series.schema.js"
import { groupBy, sumBy } from "es-toolkit"
import { KFA_LEVEL_CODE } from "@/common/constants/material.js"

export function generateMonitoringTransactionSeries(
  c: Context
): SeriesConfig[] {
  return [
    {
      id: 2,
      label: c.var.t("transaction_type.id.2"),
      key: "transaction_type_2",
      color: "#FFC002",
    },
    {
      id: 3,
      label: c.var.t("transaction_type.id.3"),
      key: "transaction_type_3",
      color: "#4EADEA",
    },
    {
      id: 101,
      label: c.var.t("transaction_type.id.101"),
      key: "transaction_type_101",
      color: "#1B3B4A",
    },
    {
      id: 102,
      label: c.var.t("transaction_type.id.102"),
      key: "transaction_type_102",
      color: "#61CFA6",
    },
    {
      id: 103,
      label: c.var.t("transaction_type.id.103"),
      key: "transaction_type_103",
      color: "#004990",
    },
    {
      id: 4,
      label: c.var.t("transaction_type.id.4"),
      key: "transaction_type_4",
      color: "#ED1B23",
    },
    {
      id: 7,
      label: c.var.t("transaction_type.id.7"),
      key: "transaction_type_7",
      color: "#7C3AED",
    },
    {
      id: 8,
      label: c.var.t("transaction_type.id.8"),
      key: "transaction_type_8",
      color: "#EA580C",
    },
  ]
}

function getActivityIdsCondition(
  queryParams: MonitoringTransactionSchemaQueryParams
): string {
  if (queryParams.activity_ids && queryParams.activity_ids.length > 0) {
    return " AND t.transactions_activity_id in {activity_ids:Array(Int64)} "
  }
  return ""
}

function getMaterialIdsCondition(
  queryParams: MonitoringTransactionSchemaQueryParams
): string {
  const { material_ids, material_level_id } = queryParams

  if (
    material_ids &&
    material_ids.length > 0 &&
    material_level_id === KFA_LEVEL_CODE.TEMPLATE
  ) {
    return " AND t.dmm_parent_id in {material_ids:Array(Int64)} "
  } else if (
    material_ids &&
    material_ids.length > 0 &&
    material_level_id === KFA_LEVEL_CODE.VARIANT
  ) {
    return " AND t.transactions_master_material_id in {material_ids:Array(Int64)} "
  }

  return ""
}

function getEntityIdCondition(
  queryParams: MonitoringTransactionSchemaQueryParams
): string {
  if (queryParams.entity_id != undefined) {
    return " AND t.entities_id = {entity_id:Int} "
  }
  return ""
}

function getMaterialTypeIdsCondition(
  queryParams: MonitoringTransactionSchemaQueryParams
): string {
  if (
    queryParams.material_type_ids &&
    queryParams.material_type_ids.length > 0
  ) {
    return " AND t.material_type_id in {is_vaccine:Array(Int64)} "
  }
  return ""
}

function getProvinceIdCondition(
  queryParams: MonitoringTransactionSchemaQueryParams
): string {
  if (queryParams.province_id != undefined) {
    return " AND t.entities_province_id = {province_id:Int} "
  }
  return ""
}

function getRegencyIdCondition(
  queryParams: MonitoringTransactionSchemaQueryParams
): string {
  if (queryParams.regency_id != undefined) {
    return " AND t.entities_regency_id = {regency_id:Int} "
  }
  return ""
}

function getEntityTagIdsCondition(
  queryParams: MonitoringTransactionSchemaQueryParams
): string {
  if (queryParams.entity_tag_ids && queryParams.entity_tag_ids.length > 0) {
    return " AND t.entity_tags_id in {entity_tag_ids:Array(Int64)} "
  }
  return ""
}

function getExpiredDateCondition(
  queryParams: MonitoringTransactionSchemaQueryParams
): string {
  if (queryParams.start_expired_date && queryParams.end_expired_date) {
    return " AND toDate(t.expired_date) BETWEEN {start_expired_date:DateTime('Asia/Jakarta')} and {end_expired_date:DateTime('Asia/Jakarta')} "
  }
  return ""
}

function getTransactionType2(
  queryParams: MonitoringTransactionSchemaQueryParams
) {
  let condition = ""
  if (queryParams.transaction_type === 2) {
    condition =
      " AND t.transactions_transaction_type_id = 2 AND t.orders_order_type_id IN (1,2,4) AND t.orders_order_status_id IN (4,5) AND t.transactions_order_id IS NOT NULL "
  }
  return condition
}

function getTransactionType3(
  queryParams: MonitoringTransactionSchemaQueryParams
) {
  let condition = ""
  if (queryParams.transaction_type === 3) {
    condition =
      " AND t.transactions_transaction_type_id = 3 AND t.orders_order_type_id IN (1,2,4) AND t.orders_order_status_id = 5 "
  }
  return condition
}

function getTransactionType4(queries: MonitoringTransactionSchemaQueryParams) {
  let condition = ""
  if (queries.transaction_type === 4) {
    condition = " AND t.transactions_transaction_type_id IN (4,9) "
  }
  return condition
}

function getTransactionType7(queries: MonitoringTransactionSchemaQueryParams) {
  let condition = ""
  if (queries.transaction_type === 7) {
    condition = " AND t.transactions_transaction_type_id IN (7) "
  }
  return condition
}

function getTransactionType8(queries: MonitoringTransactionSchemaQueryParams) {
  let condition = ""
  if (queries.transaction_type === 8) {
    condition = " AND t.transactions_transaction_type_id IN (8) "
  }
  return condition
}

function getTransactionType101(
  queryParams: MonitoringTransactionSchemaQueryParams
) {
  let condition = ""
  if (queryParams.transaction_type === 101) {
    condition =
      " AND t.transactions_transaction_type_id = 3 AND t.orders_order_type_id = 3 AND t.orders_order_status_id = 5 "
  }
  return condition
}

function getTransactionType102(
  queryParams: MonitoringTransactionSchemaQueryParams
) {
  let condition = ""
  if (queryParams.transaction_type === 102) {
    condition =
      " AND t.transactions_transaction_type_id = 2 AND t.orders_order_type_id = 3 AND t.orders_order_status_id IN (4,5)  "
  }
  return condition
}

function getTransactionType103(
  queries: MonitoringTransactionSchemaQueryParams
) {
  let condition = ""
  if (queries.transaction_type === 103) {
    condition =
      " AND t.transactions_transaction_type_id IN (10,5) AND t.transactions_order_id IS NULL "
  }
  return condition
}

export function conditionQuery(
  queryParams: MonitoringTransactionSchemaQueryParams
) {
  let conditionQuery = ""

  conditionQuery += " AND t.program_id = {program_id:Int} "
  conditionQuery += getActivityIdsCondition(queryParams)
  conditionQuery += getMaterialIdsCondition(queryParams)
  conditionQuery += getEntityIdCondition(queryParams)
  conditionQuery += getMaterialTypeIdsCondition(queryParams)
  conditionQuery += getProvinceIdCondition(queryParams)
  conditionQuery += getRegencyIdCondition(queryParams)
  conditionQuery += getEntityTagIdsCondition(queryParams)
  conditionQuery += getExpiredDateCondition(queryParams)
  conditionQuery += getTransactionType2(queryParams)
  conditionQuery += getTransactionType3(queryParams)
  conditionQuery += getTransactionType4(queryParams)
  conditionQuery += getTransactionType7(queryParams)
  conditionQuery += getTransactionType8(queryParams)
  conditionQuery += getTransactionType101(queryParams)
  conditionQuery += getTransactionType102(queryParams)
  conditionQuery += getTransactionType103(queryParams)

  return conditionQuery
}

export function valueConditionQuery(
  c: Context,
  queryParams: MonitoringTransactionSchemaQueryParams
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

/**
 * Process data for chart
 */
export function processChartData(
  c: Context,
  data: MonitoringTransactionDTO[],
  queryParams: MonitoringTransactionSchemaQueryParams,
  serieses: SeriesConfig[],
  categories: MonitoringTransactionChartCategoriesDTO[],
  groupByKey: keyof MonitoringTransactionDTO
) {
  // Group data by period
  const groupedData = groupBy(data, (item) => `${item[groupByKey]}`)

  const dataset: MonitoringTransactionChartDatasetDTO[] = []

  serieses.forEach((series) => {
    const seriesData: number[] = []

    categories.forEach((category) => {
      const dataPerGroup = groupedData[category.id] || []
      const filteredByTransactionType = dataPerGroup.filter(
        (item) => item.transaction_type_id === series.id
      )

      const value = sumBy(filteredByTransactionType, (item) => item.value ?? 0)
      const count = sumBy(filteredByTransactionType, (item) => item.count ?? 0)

      const endValue = queryParams.information_type === 1 ? count : value
      seriesData.push(endValue)
    })

    // Hardcoded condition
    let dottedLine = false
    if (
      series.key === "transaction_type_2" ||
      series.key === "transaction_type_3" ||
      series.key === "transaction_type_101" ||
      series.key === "transaction_type_102"
    ) {
      dottedLine = true
    }

    dataset.push({
      label: series.label,
      color: series.color,
      dotted_line: dottedLine,
      data: seriesData,
    })
  })

  return dataset
}
