import {
  OrderResponseDataDTO,
  OrderResponseDatasetDTO,
  OrderResponseQueryParams,
  OrderResponseReviewDatasetDTO,
} from "./order-response.schema.js"
import { groupBy, sumBy } from "es-toolkit"
import { Context } from "hono"
import { PeriodDTO } from "@/common/schemas/period.schema.js"
import { SeriesConfig } from "@/common/schemas/series.schema.js"

export function generateOrderResponseSeries(c: Context): SeriesConfig[] {
  return [
    {
      id: 1,
      label: c.var.t("order-response.series.doa"),
      key: "doa",
      color: "#ffc002",
    },
    {
      id: 2,
      label: c.var.t("order-response.series.das"),
      key: "das",
      color: "#0080c3",
    },
    {
      id: 3,
      label: c.var.t("order-response.series.dsr"),
      key: "dsr",
      color: "#00b050",
    },
  ]
}

/**
 * Process order response data for review endpoint (chart format)
 */
export function processReviewData(
  c: Context,
  data: OrderResponseDataDTO[],
  queryParams: OrderResponseQueryParams,
  serieses: SeriesConfig[],
  categories: PeriodDTO[]
): OrderResponseReviewDatasetDTO[] {
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

  const dataset: OrderResponseReviewDatasetDTO[] = []

  serieses.forEach((series) => {
    const seriesData: number[] = []

    categories.forEach((category) => {
      const dataPerGroup = groupedData[category.id] || []

      // Calculate averages for this period
      const avgValue =
        dataPerGroup.length > 0
          ? sumBy(dataPerGroup, (item) => {
              switch (series.key) {
                case "doa":
                  return item.doa
                case "das":
                  return item.das
                case "dsr":
                  return item.dsr
                default:
                  return 0
              }
            }) / dataPerGroup.length
          : 0

      seriesData.push(Math.ceil(avgValue))
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
 * Process material data for material endpoint
 */
export function processOrderResponseData(
  items: Array<{
    id: number
    name: string
    province_name?: string | null
    regency_name?: string | null
  }>,
  orderResponseData: OrderResponseDataDTO[],
  queryParams: OrderResponseQueryParams,
  groupByKey: keyof OrderResponseDataDTO,
  serieses: SeriesConfig[],
  categories: PeriodDTO[]
): OrderResponseDatasetDTO[] {
  const { period = "month" } = queryParams

  // Group order response data by material and period
  const groupedByKey = groupBy(orderResponseData, (item) => item[groupByKey])

  return items.map((item) => {
    const itemData = groupedByKey[item.id] || []

    // Group item data by period
    const groupedByPeriod = groupBy(itemData, (item) => {
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

    const periodResult = categories.map((category) => {
      const dataPerPeriod = groupedByPeriod[category.id] || []
      const seriesResult = {
        doa: 0,
        das: 0,
        dsr: 0,
      }

      // Calculate averages for this material and period
      const avgDoa =
        dataPerPeriod.length > 0
          ? sumBy(dataPerPeriod, (item) => item.doa) / dataPerPeriod.length
          : 0
      const avgDas =
        dataPerPeriod.length > 0
          ? sumBy(dataPerPeriod, (item) => item.das) / dataPerPeriod.length
          : 0
      const avgDsr =
        dataPerPeriod.length > 0
          ? sumBy(dataPerPeriod, (item) => item.dsr) / dataPerPeriod.length
          : 0

      serieses.forEach((series) => {
        switch (series.key) {
          case "doa":
            seriesResult.doa = Math.ceil(avgDoa)
            break
          case "das":
            seriesResult.das = Math.ceil(avgDas)
            break
          case "dsr":
            seriesResult.dsr = Math.ceil(avgDsr)
            break
        }
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
