import { groupBy, sumBy } from "es-toolkit"
import {
  ConsumptionSupplyQueryParams,
  ConsumptionSupplyDataDTO,
  ConsumptionSupplyReviewDatasetDTO,
  ConsumptionSupplyDatasetDTO,
} from "./consumption-supply.schema.js"
import { Context } from "hono"
import { SeriesConfig } from "@/common/schemas/series.schema.js"
import { PeriodDTO } from "@/common/schemas/period.schema.js"

/**
 * Get series configuration for consumption supply
 * Similar to generateOrderDifferenceSeries but for consumption/supply
 */
export function generateConsumptionSupplySeries(
  c: Context,
  queryParams: ConsumptionSupplyQueryParams
): SeriesConfig[] {
  const { information_type } = queryParams

  if (information_type === "supply") {
    return [
      {
        id: 1,
        label: c.var.t("consumption-supply.series.supply"),
        key: "supply",
        color: "#0080c3",
      },
    ]
  }

  if (information_type === "consumption") {
    return [
      {
        id: 2,
        label: c.var.t("consumption-supply.series.consumption"),
        key: "consumption",
        color: "#66CDAA",
      },
    ]
  }

  return [
    {
      id: 1,
      label: c.var.t("consumption-supply.series.supply"),
      key: "supply",
      color: "#0080c3",
    },
    {
      id: 2,
      label: c.var.t("consumption-supply.series.consumption"),
      key: "consumption",
      color: "#66CDAA",
    },
  ]
}

/**
 * Sum values by key from grouped data
 * Similar to getOrderDifferenceValue but for consumption/supply
 */
export function getConsumptionSupplyValue(
  dataGroup: ConsumptionSupplyDataDTO[] | undefined,
  key: string
): number {
  if (!dataGroup || dataGroup.length === 0) {
    return 0
  }

  return sumBy(dataGroup, (item) => {
    switch (key) {
      case "consumption":
        return item.consumption || 0
      case "supply":
        return item.supply || 0
      default:
        return 0
    }
  })
}

/**
 * Process data for review endpoint (chart format)
 */
export function processReviewData(
  c: Context,
  data: ConsumptionSupplyDataDTO[],
  queryParams: ConsumptionSupplyQueryParams,
  serieses: SeriesConfig[],
  categories: PeriodDTO[]
): ConsumptionSupplyReviewDatasetDTO[] {
  const { period = "month" } = queryParams

  // Group data by period
  const groupedData = groupBy(data, (item) => {
    switch (period) {
      case "month":
        return item.month
      case "week":
        return `${item.year}-W${item.week}`
      case "day":
      default:
        return item.day
    }
  })

  const dataset: ConsumptionSupplyReviewDatasetDTO[] = []

  serieses.forEach((series) => {
    const seriesData: number[] = []

    categories.forEach((category) => {
      const dataPerGroup = groupedData[category.id]
      const value = getConsumptionSupplyValue(dataPerGroup, series.key)
      seriesData.push(value)
    })

    dataset.push({
      label: series.label,
      color: series.color,
      data: seriesData,
    })
  })

  return dataset
}

/**
 * Unified function to process consumption supply data for material, entity, or location endpoints
 * @param data - Raw consumption supply data
 * @param items - Array of items (materials, entities, or locations) to process
 * @param queryParams - Query parameters including period
 * @param groupByKey - Key to group the data by (e.g., "selected_id")
 * @returns Processed dataset for the endpoint
 */
export function processConsumptionSupplyData(
  c: Context,
  data: ConsumptionSupplyDataDTO[],
  items: Array<{
    id: number
    name: string
    province_name?: string | null
    regency_name?: string | null
  }>,
  queryParams: ConsumptionSupplyQueryParams,
  groupByKey: keyof ConsumptionSupplyDataDTO,
  serieses: SeriesConfig[],
  categories: PeriodDTO[]
): ConsumptionSupplyDatasetDTO[] {
  const { period = "month" } = queryParams

  // Group data by the specified key
  const groupedByKey = groupBy(
    data,
    (item) => item[groupByKey] as string | number
  )

  return items.map((item) => {
    const itemData = groupedByKey[item.id] || []

    // Group item data by period
    const groupedByPeriod = groupBy(itemData, (dataItem) => {
      switch (period) {
        case "month":
          return dataItem.month
        case "week":
          return `${dataItem.year}-W${dataItem.week}`
        case "day":
        default:
          return dataItem.day
      }
    })

    const periodResult = categories.map((category) => {
      const dataPerPeriod = groupedByPeriod[category.id]

      const seriesResult = {
        supply: 0,
        consumption: 0,
      }

      serieses.forEach((series) => {
        const value = getConsumptionSupplyValue(dataPerPeriod, series.key)
        seriesResult[series.key as keyof typeof seriesResult] = value
      })

      return seriesResult
    })

    return {
      id: item.id,
      name: item.name,
      province_name: item.province_name || undefined,
      regency_name: item.regency_name || undefined,
      period: periodResult,
    }
  })
}
