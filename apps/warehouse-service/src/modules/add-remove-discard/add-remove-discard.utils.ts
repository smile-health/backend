import { groupBy, sumBy } from "es-toolkit"
import {
  AddRemoveDiscardBaseQueryParams,
  AddRemoveDiscardDataDTO,
  AddRemoveDiscardReviewDatasetDTO,
  AddRemoveDiscardDatasetDTO,
  TransactionReasonDTO,
} from "./add-remove-discard.schema.js"
import { Context } from "hono"
import { SeriesConfig } from "@/common/schemas/series.schema.js"
import { PeriodDTO } from "@/common/schemas/period.schema.js"

/**
 * Convert transaction reason title to a safe key for response
 * @param title - Transaction reason title
 * @returns Safe key string
 */
export function reasonTitleToKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Generate series configuration from transaction reasons
 * Shared between both modules
 * @param c - Hono context
 * @param reasons - Transaction reasons from database
 * @returns Series configuration array
 */
export function generateSeriesFromReasons(
  c: Context,
  reasons: TransactionReasonDTO[]
): SeriesConfig[] {
  // Simple color palette for consistent coloring
  const colors = [
    "#2b3a67",
    "#ffc482",
    "#9BC53D",
    "#5BC0EB",
    "#E55934",
    "#FF1654",
    "#66CDAA",
    "#40A0E0",
    "#fcdc00",
    "#BFA59B",
  ]

  return reasons.map((reason, index) => ({
    id: reason.id,
    label: c.var.t(`transaction.reason.${reason.title}`),
    key: reasonTitleToKey(reason.title),
    color: colors[index % colors.length] || "#666666",
  }))
}

/**
 * Sum values by transaction reason ID from grouped data
 * Shared utility for both modules
 * @param dataGroup - Grouped data array
 * @param reasonId - Transaction reason ID to sum
 * @returns Summed value
 */
export function getAddRemoveDiscardValue(
  dataGroup: AddRemoveDiscardDataDTO[] | undefined,
  reasonId: number
): number {
  if (!dataGroup || dataGroup.length === 0) {
    return 0
  }

  return sumBy(dataGroup, (item) => {
    return item.transaction_reason_id === reasonId ? item.change_qty || 0 : 0
  })
}

/**
 * Process data for review endpoint (chart format)
 * Shared between both modules
 */
export function processReviewData(
  c: Context,
  data: AddRemoveDiscardDataDTO[],
  queryParams: AddRemoveDiscardBaseQueryParams,
  serieses: SeriesConfig[],
  categories: PeriodDTO[]
): AddRemoveDiscardReviewDatasetDTO[] {
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

  const dataset: AddRemoveDiscardReviewDatasetDTO[] = []

  serieses.forEach((series) => {
    const seriesData: number[] = []

    categories.forEach((category) => {
      const dataPerGroup = groupedData[category.id]
      const value = getAddRemoveDiscardValue(dataPerGroup, series.id)
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
 * Unified function to process add-remove-discard data for material, entity, or location endpoints
 * Shared between both modules
 * @param data - Raw add-remove-discard data
 * @param items - Array of items (materials, entities, or locations) to process
 * @param queryParams - Query parameters including period
 * @param groupByKey - Key to group the data by (e.g., "master_material_id", "entities_id", "location_id")
 * @param serieses - Series configuration from transaction reasons
 * @param categories - Period categories
 * @returns Processed dataset for the endpoint
 */
export function processAddRemoveDiscardData(
  c: Context,
  data: AddRemoveDiscardDataDTO[],
  items: Array<{
    id: number
    name: string
    province_name?: string | null
    regency_name?: string | null
  }>,
  queryParams: AddRemoveDiscardBaseQueryParams,
  groupByKey: keyof AddRemoveDiscardDataDTO,
  serieses: SeriesConfig[],
  categories: PeriodDTO[]
): AddRemoveDiscardDatasetDTO[] {
  const { period = "month" } = queryParams

  // Group data by the specified key
  const groupedByKey = groupBy(data, (item) => String(item[groupByKey] || 0))

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
      const seriesResult: Record<string, number> = {}

      // Initialize all series keys to 0
      serieses.forEach((series) => {
        seriesResult[series.key] = 0
      })

      // Fill in actual values from data
      serieses.forEach((series) => {
        const value = getAddRemoveDiscardValue(dataPerPeriod, series.id)
        seriesResult[series.key] = value
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

/**
 * Generate type array from series for response
 * Shared between both modules
 * @param serieses - Series configuration
 * @returns Array of series labels
 */
export function generateTypeFromSeries(
  serieses: SeriesConfig[]
): { label: string; key: string }[] {
  return serieses.map((series) => ({
    label: series.label,
    key: series.key,
  }))
}
