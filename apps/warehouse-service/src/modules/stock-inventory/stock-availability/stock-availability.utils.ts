import { Context } from "hono"
import {
  ProcessableItem,
  StockInventoryData,
  StockInventoryEntityMaterialDataset,
  StockInventoryListDataset,
  StockInventoryResultItem,
} from "../stock-inventory.schema.js"
import _ from "lodash"
import { MaterialItemDTO } from "@/modules/material/material.schema.js"
import { createCompositeKey, FIXED_NUMBER } from "../stock-inventory.utils.js"
import { DAY_IN_SECONDS } from "../abnormal-stock/abnormal-stock.utils.js"
import { PeriodDTO } from "@/common/schemas/period.schema.js"

/**
 * Calculate stock availability result based on information type
 * Used by stock-availability module
 */
type StockInventoryDataWithPercentage = StockInventoryData & {
  total_duration_percentage: number
}

export function getStockAvailabilityResult(
  groupedData: Record<string, StockInventoryDataWithPercentage[]>,
  categories: PeriodDTO[] | string[],
  informationType: number = 1
): StockInventoryResultItem[] {
  const result: StockInventoryResultItem[] = []

  switch (informationType) {
    case 1:
      // Availability percentage
      categories.forEach((interval) => {
        const intervalKey =
          typeof interval === "string" ? interval : interval.selector
        const dataPerGroup = groupedData[intervalKey] || []

        const divider = _.uniqBy(dataPerGroup, createCompositeKey).length
        const totalPercentage = _.sumBy(
          dataPerGroup,
          "total_duration_percentage"
        )
        const availability =
          dataPerGroup.length > 0 ? totalPercentage / divider : 0

        result.push({
          label:
            typeof interval === "string"
              ? intervalKey
              : interval.label || intervalKey,
          availability: availability
            ? parseFloat(availability.toFixed(FIXED_NUMBER))
            : "-",
        })
      })
      break

    case 2:
      // Material-Entity availability percentage
      categories.forEach((interval) => {
        const intervalKey =
          typeof interval === "string" ? interval : interval.selector
        const dataPerGroup = groupedData[intervalKey] || []
        const { greater90, between70And90, between50And70, lesser50 } =
          calculatePercentageProportion(dataPerGroup)

        result.push({
          label:
            typeof interval === "string"
              ? intervalKey
              : interval.label || intervalKey,
          "90-100": greater90,
          "70-89": between70And90,
          "50-69": between50And70,
          "<50": lesser50,
        })
      })
      break

    case 3:
      // Entity availability percentage
      categories.forEach((interval) => {
        const intervalKey =
          typeof interval === "string" ? interval : interval.selector
        const dataPerGroup = groupedData[intervalKey] || []
        const dataGroupedByEntity = _.groupBy(dataPerGroup, "entity_id")

        const totalGreater90: number[] = []
        const totalBetween70And90: number[] = []
        const totalBetween50And70: number[] = []
        const totalLesser50: number[] = []

        Object.keys(dataGroupedByEntity).forEach((entityId) => {
          const dataPerEntity = dataGroupedByEntity[entityId] || []
          const { greater90, between70And90, between50And70, lesser50 } =
            calculatePercentageProportion(dataPerEntity)

          totalGreater90.push(parseFloat(greater90.toString()) || 0)
          totalBetween70And90.push(parseFloat(between70And90.toString()) || 0)
          totalBetween50And70.push(parseFloat(between50And70.toString()) || 0)
          totalLesser50.push(parseFloat(lesser50.toString()) || 0)
        })

        result.push({
          label:
            typeof interval === "string"
              ? intervalKey
              : interval.label || intervalKey,
          "90-100": parseFloat(
            (_.mean(totalGreater90) || 0).toFixed(FIXED_NUMBER)
          ),
          "70-89": parseFloat(
            (_.mean(totalBetween70And90) || 0).toFixed(FIXED_NUMBER)
          ),
          "50-69": parseFloat(
            (_.mean(totalBetween50And70) || 0).toFixed(FIXED_NUMBER)
          ),
          "<50": parseFloat((_.mean(totalLesser50) || 0).toFixed(FIXED_NUMBER)),
        })
      })
      break

    case 4:
      // Material availability percentage
      categories.forEach((interval) => {
        const intervalKey =
          typeof interval === "string" ? interval : interval.selector
        const dataPerGroup = groupedData[intervalKey] || []
        const dataGroupedByMaterial = _.groupBy(
          dataPerGroup,
          "master_material_id"
        )

        const totalGreater90: number[] = []
        const totalBetween70And90: number[] = []
        const totalBetween50And70: number[] = []
        const totalLesser50: number[] = []

        Object.keys(dataGroupedByMaterial).forEach((materialId) => {
          const dataPerMaterial = dataGroupedByMaterial[materialId] || []
          const { greater90, between70And90, between50And70, lesser50 } =
            calculatePercentageProportion(dataPerMaterial)

          totalGreater90.push(parseFloat(greater90.toString()) || 0)
          totalBetween70And90.push(parseFloat(between70And90.toString()) || 0)
          totalBetween50And70.push(parseFloat(between50And70.toString()) || 0)
          totalLesser50.push(parseFloat(lesser50.toString()) || 0)
        })

        result.push({
          label:
            typeof interval === "string"
              ? intervalKey
              : interval.label || intervalKey,
          "90-100": parseFloat(
            (_.mean(totalGreater90) || 0).toFixed(FIXED_NUMBER)
          ),
          "70-89": parseFloat(
            (_.mean(totalBetween70And90) || 0).toFixed(FIXED_NUMBER)
          ),
          "50-69": parseFloat(
            (_.mean(totalBetween50And70) || 0).toFixed(FIXED_NUMBER)
          ),
          "<50": parseFloat((_.mean(totalLesser50) || 0).toFixed(FIXED_NUMBER)),
        })
      })
      break

    default:
      break
  }

  return result
}

/**
 * Convert duration to percentage
 * Shared utility for both stock-availability and abnormal-stock
 */
export function mutateDurationToPercentage(
  data: StockInventoryData[],
  categories: PeriodDTO[],
  durations: number[]
): (StockInventoryData & { total_duration_percentage: number })[] {
  return data.map((item) => {
    const periodIndex = categories.findIndex(
      (cat) => cat.selector === item.period
    )
    const periodDuration = durations[periodIndex] || DAY_IN_SECONDS

    const totalDurationPercentage =
      (item.total_duration_seconds / periodDuration) * 100 || 0

    return {
      ...item,
      total_duration_percentage: parseFloat(
        totalDurationPercentage.toFixed(FIXED_NUMBER)
      ),
    }
  })
}

/**
 * Calculate percentage proportions for information types 2, 3, 4
 * Used by stock-availability module
 */
function calculatePercentageProportion(
  dataPerGroup: StockInventoryDataWithPercentage[]
): {
  greater90: number | string
  between70And90: number | string
  between50And70: number | string
  lesser50: number | string
} {
  const divider = _.uniqBy(dataPerGroup, createCompositeKey).length

  const greater90Count =
    _.countBy(
      dataPerGroup,
      (item) =>
        item.total_duration_percentage != 0 &&
        item.total_duration_percentage > 90
    ).true || 0

  const between70And90Count =
    _.countBy(
      dataPerGroup,
      (item) =>
        item.total_duration_percentage != 0 &&
        item.total_duration_percentage >= 70 &&
        item.total_duration_percentage < 90
    ).true || 0

  const between50And70Count =
    _.countBy(
      dataPerGroup,
      (item) =>
        item.total_duration_percentage != 0 &&
        item.total_duration_percentage >= 50 &&
        item.total_duration_percentage < 70
    ).true || 0

  const lesser50Count =
    _.countBy(
      dataPerGroup,
      (item) =>
        item.total_duration_percentage != 0 &&
        item.total_duration_percentage < 50
    ).true || 0

  const greater90 = (greater90Count / divider) * 100 || 0
  const between70And90 = (between70And90Count / divider) * 100 || 0
  const between50And70 = (between50And70Count / divider) * 100 || 0
  const lesser50 = (lesser50Count / divider) * 100 || 0

  return {
    greater90:
      dataPerGroup.length > 0
        ? parseFloat(greater90.toFixed(FIXED_NUMBER))
        : "-",
    between70And90:
      dataPerGroup.length > 0
        ? parseFloat(between70And90.toFixed(FIXED_NUMBER))
        : "-",
    between50And70:
      dataPerGroup.length > 0
        ? parseFloat(between50And70.toFixed(FIXED_NUMBER))
        : "-",
    lesser50:
      dataPerGroup.length > 0
        ? parseFloat(lesser50.toFixed(FIXED_NUMBER))
        : "-",
  }
}

/**
 * Average data per entity-material for entity-material endpoint
 * Used by stock-availability module
 */
export function averageDataPerEntityMaterial(
  dataGroupedByMaterial: Record<string, StockInventoryDataWithPercentage[]>
): Record<string, StockInventoryDataWithPercentage[]> {
  const result: Record<string, StockInventoryDataWithPercentage[]> = {}

  Object.keys(dataGroupedByMaterial).forEach((materialId) => {
    const dataPerMaterial = dataGroupedByMaterial[materialId]
    if (!dataPerMaterial || dataPerMaterial.length === 0) {
      return // Skip empty material groups
    }

    const averageDataPerMaterial = dataPerMaterial.reduce(
      (previous, current, index, array) => {
        let totalDurationPercentage =
          previous.total_duration_percentage + current.total_duration_percentage

        if (index === array.length - 1) {
          totalDurationPercentage = parseFloat(
            (totalDurationPercentage / array.length).toFixed(FIXED_NUMBER)
          )
        }

        return {
          ...previous,
          total_duration_percentage: totalDurationPercentage,
        }
      }
    )

    if (!result[materialId]) {
      result[materialId] = []
    }

    result[materialId].push(averageDataPerMaterial)
  })

  return result
}

export function processStockAvailabilityData(
  items: ProcessableItem[],
  stockData: StockInventoryDataWithPercentage[],
  categories: PeriodDTO[],
  groupByKey: string,
  informationType: number = 1,
  options: {
    includeLocationFields?: boolean
    materials?: MaterialItemDTO[]
  } = {}
): StockInventoryEntityMaterialDataset[] | StockInventoryListDataset[] {
  // Input validation
  if (!Array.isArray(items)) {
    throw new Error("Items must be a valid array")
  }

  if (!Array.isArray(stockData)) {
    throw new Error("Stock data must be a valid array")
  }

  if (!Array.isArray(categories)) {
    throw new Error("Categories must be a valid array")
  }

  if (!groupByKey || typeof groupByKey !== "string") {
    throw new Error("Group by key must be a non-empty string")
  }

  const { includeLocationFields = false, materials } = options

  try {
    // Handle entity-material special case
    if (materials) {
      const dataGroupByEntity = _.groupBy(stockData, "entity_id")

      return items.map((entity) => {
        if (!entity || !entity.id) {
          throw new Error("Invalid entity: missing id field")
        }

        const dataPerEntity = dataGroupByEntity[entity.id] || []

        const dataGroupedByMaterial = _.groupBy(
          dataPerEntity,
          "master_material_id"
        )

        const averagedData = averageDataPerEntityMaterial(
          dataGroupedByMaterial as Record<
            string,
            StockInventoryDataWithPercentage[]
          >
        )
        const materialIds = materials.map((m) => m.id.toString())

        const periodData: StockInventoryResultItem[] =
          getStockAvailabilityResult(averagedData, materialIds, informationType)

        return {
          id: entity.id,
          name: entity.name,
          province_name: entity.province_name ?? "",
          province_id: Number(entity.province_id),
          regency_name: entity.regency_name ?? "",
          regency_id: Number(entity.regency_id),
          period: periodData,
        }
      })
    }

    // Regular processing for material, entity, location
    const dataGroupByKey = _.groupBy(stockData, groupByKey)

    return items.map((item) => {
      if (!item || !item.id) {
        throw new Error("Invalid item: missing id field")
      }

      const dataPerItem = dataGroupByKey[item.id] || []

      const dataGroupedByPeriod = _.groupBy(dataPerItem, "period")
      const periodData: StockInventoryResultItem[] = getStockAvailabilityResult(
        dataGroupedByPeriod,
        categories,
        informationType
      )

      const result: StockInventoryListDataset = {
        id: item.id,
        name: item.name,
        period: periodData,
      }

      // Add location fields if needed (for entity endpoint)
      if (includeLocationFields) {
        result.province_name = item.province_name
        result.regency_name = item.regency_name
      }

      return result
    })
  } catch (error) {
    // Re-throw with more context
    throw new Error(
      `Error processing stock inventory data: ${error instanceof Error ? error.message : "Unknown error"}`
    )
  }
}

/**
 * Generate type array for stock availability responses based on information type
 * Used by stock-availability module
 */
export function generateStockAvailabilityTypes(
  c: Context,
  informationType: number = 1
): Array<{ key: string; label: string }> {
  if (informationType === 1) {
    // Information type 1: Only availability
    return [
      {
        key: "availability",
        label: c.var.t("common.overview"),
      },
    ]
  } else {
    // Information types 2, 3, 4: Percentage ranges
    return [
      { key: "90-100", label: "90-100%" },
      { key: "70-89", label: "70-89%" },
      { key: "50-69", label: "50-69%" },
      { key: "<50", label: "<50%" },
    ]
  }
}
