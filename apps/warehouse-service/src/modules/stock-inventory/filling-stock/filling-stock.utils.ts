import { MaterialItemDTO } from "@/modules/material/material.schema.js"
import {
  ProcessableItem,
  StockInventoryData,
  StockInventoryEntityMaterialDataset,
  StockInventoryListDataset,
  StockInventoryResultItem,
} from "../stock-inventory.schema.js"
import _ from "lodash"
import { createCompositeKey } from "../stock-inventory.utils.js"
import { PeriodDTO } from "@/common/schemas/period.schema.js"

export const DAY_IN_SECONDS = 86400

/**
 * Calculate filling stock value based on information type
 * Used by filling-stock module - adapted from abnormal-stock getStockValue function
 */
export function getFillingStockValue(
  stockData: StockInventoryData[],
  totalEhmm: number,
  informationType: string = "count"
): number | string {
  let value = 0
  if (informationType === "count") {
    value = _.sumBy(stockData, (item) => item.total_frequency)
  } else if (informationType === "days") {
    value = _.sumBy(stockData, (item) => item.total_duration_seconds)
    value = value / totalEhmm
    value = value / DAY_IN_SECONDS
  }

  return stockData.length > 0 ? Math.ceil(value) : "-"
}

/**
 * Unified function to process stock inventory data for material, entity, or location endpoints
 * Shared between stock-availability and filling-stock modules
 */
export function processFillingStockData(
  items: ProcessableItem[],
  stockData: StockInventoryData[],
  categories: PeriodDTO[],
  groupByKey: string,
  options: {
    includeLocationFields?: boolean
    materials?: MaterialItemDTO[]
    fillingInformationType?: string
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

  const {
    includeLocationFields = false,
    materials,
    fillingInformationType = "count",
  } = options

  console.log(fillingInformationType)

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

        const periodData: StockInventoryResultItem[] = materials.map(
          (material) => {
            const materialData = dataGroupedByMaterial[material.id] || []
            const divider = _.uniqBy(materialData, createCompositeKey).length
            const value = getFillingStockValue(
              materialData,
              divider,
              fillingInformationType
            )

            return {
              label: material.id.toString(),
              value: value,
            }
          }
        )

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

      const periodData: StockInventoryResultItem[] = categories.map(
        (category) => {
          const periodData =
            dataGroupedByPeriod[category.selector || category.id || ""] || []
          const divider = _.uniqBy(periodData, createCompositeKey).length
          const value = getFillingStockValue(
            periodData,
            divider,
            fillingInformationType
          )

          return {
            label: category.label || category.selector || category.id || "",
            value: value,
          }
        }
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
 * Generate type array for filling stock responses
 * Used by filling-stock module
 */
export function generateFillingStockTypes(): Array<{
  key: string
  label: string
}> {
  return [
    {
      key: "value",
      label: "Value",
    },
  ]
}
