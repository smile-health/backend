import { groupBy, sumBy } from "es-toolkit"
import {
  OrderDifferenceQueryParams,
  OrderDifferenceDataDTO,
  InformationType,
  OrderDifferenceReviewDatasetDTO,
  OrderDifferenceDatasetDTO,
} from "./order-difference.schema.js"
import { Context } from "hono"
import { SeriesConfig } from "@/common/schemas/series.schema.js"
import { PeriodDTO } from "@/common/schemas/period.schema.js"

/**
 * Get series configuration based on information type
 * Replicates the getOrderInfoType function from the old codebase
 */
export function generateOrderDifferenceSeries(
  c: Context,
  informationType?: string | null
): SeriesConfig[] {
  switch (informationType) {
    case InformationType.PESANAN_BARU:
      return [
        {
          id: 1,
          label: c.var.t(`order-difference.series.recommended`),
          key: "recommended",
          color: "#66CDAA",
        },
        {
          id: 2,
          label: c.var.t(`order-difference.series.ordered`),
          key: "ordered",
          color: "#40A0E0",
        },
      ]
    case InformationType.PENGIRIMAN:
      return [
        {
          id: 1,
          label: c.var.t(`order-difference.series.ordered`),
          key: "ordered",
          color: "#40A0E0",
        },
        {
          id: 2,
          label: c.var.t(`order-difference.series.sent`),
          key: "sent",
          color: "#fcdc00",
        },
      ]
    case InformationType.PENERIMAAN:
      return [
        {
          id: 1,
          label: c.var.t(`order-difference.series.sent`),
          key: "sent",
          color: "#fcdc00",
        },
        {
          id: 2,
          label: c.var.t(`order-difference.series.received`),
          key: "received",
          color: "#BFA59B",
        },
      ]
    default:
      return [
        {
          id: 1,
          label: c.var.t(`order-difference.series.recommended`),
          key: "recommended",
          color: "#66CDAA",
        },
        {
          id: 2,
          label: c.var.t(`order-difference.series.ordered`),
          key: "ordered",
          color: "#40A0E0",
        },
        {
          id: 3,
          label: c.var.t(`order-difference.series.sent`),
          key: "sent",
          color: "#fcdc00",
        },
        {
          id: 4,
          label: c.var.t(`order-difference.series.received`),
          key: "received",
          color: "#BFA59B",
        },
      ]
  }
}

/**
 * Sum values by key from grouped data
 * Replicates the getOrderDifferenceValue function from the old codebase
 */
export function getOrderDifferenceValue(
  dataGroup: OrderDifferenceDataDTO[] | undefined,
  key: string
): number {
  if (!dataGroup || dataGroup.length === 0) {
    return 0
  }

  return sumBy(dataGroup, (item) => {
    switch (key) {
      case "recommended":
        return item.recommended || 0
      case "ordered":
        return item.ordered || 0
      case "sent":
        return item.sent || 0
      case "received":
        return item.received || 0
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
  data: OrderDifferenceDataDTO[],
  queryParams: OrderDifferenceQueryParams,
  serieses: SeriesConfig[],
  categories: PeriodDTO[]
): OrderDifferenceReviewDatasetDTO[] {
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

  const dataset: OrderDifferenceReviewDatasetDTO[] = []

  serieses.forEach((series) => {
    const seriesData: number[] = []

    categories.forEach((category) => {
      const dataPerGroup = groupedData[category.id]
      const value = getOrderDifferenceValue(dataPerGroup, series.key)
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
 * Unified function to process order difference data for material, entity, or location endpoints
 * @param data - Raw order difference data
 * @param items - Array of items (materials, entities, or locations) to process
 * @param queryParams - Query parameters including period and information_type
 * @param groupByKey - Key to group the data by (e.g., "master_material_id", "entities_id", "location_id")
 * @returns Processed dataset for the endpoint
 */
export function processOrderDifferenceData(
  c: Context,
  data: OrderDifferenceDataDTO[],
  items: Array<{
    id: number
    name: string
    province_name?: string | null
    regency_name?: string | null
  }>,
  queryParams: OrderDifferenceQueryParams,
  groupByKey: keyof OrderDifferenceDataDTO,
  serieses: SeriesConfig[],
  categories: PeriodDTO[]
): OrderDifferenceDatasetDTO[] {
  const { period = "month" } = queryParams

  // Group data by the specified key
  const groupedByKey = groupBy(data, (item) => item[groupByKey])

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
        recommended: 0,
        ordered: 0,
        sent: 0,
        received: 0,
      }

      serieses.forEach((series) => {
        const value = getOrderDifferenceValue(dataPerPeriod, series.key)
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
