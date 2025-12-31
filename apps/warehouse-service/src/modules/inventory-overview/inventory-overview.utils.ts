import { Context } from "hono"
import { InventoryDataDTO } from "./inventory-overview.schema.js"

export function buildStockData(
  c: Context,
  label: string,
  type: string,
  isSelected: boolean,
  filtered: InventoryDataDTO[],
  inventories: InventoryDataDTO[]
) {
  const materials = [
    ...new Set(inventories.map((data) => data.transactions_master_material_id)),
  ]
  const entities = [...new Set(inventories.map((data) => data.entities_id))]
  const activities = [
    ...new Set(inventories.map((data) => data.transactions_activity_id)),
  ]

  const filteredMaterials = [
    ...new Set(filtered.map((data) => data.transactions_master_material_id)),
  ]
  const filteredEntities = [
    ...new Set(filtered.map((data) => data.entities_id)),
  ]
  const filteredActivities = [
    ...new Set(filtered.map((data) => data.transactions_activity_id)),
  ]

  const value = filtered.length
  const totals = inventories.length
  const percent =
    totals > 0 ? parseFloat(((value / totals) * 100).toFixed(2)) : 0

  const materialLabel = c.var.t("common.material")
  const entityLabel = c.var.t("common.entity")
  const activityLabel = c.var.t("common.activity")

  const fromLabel = c.var.t("common.from")
  const inLabel = c.var.t("common.in")

  return {
    label,
    type,
    is_selected: isSelected,
    value,
    totals,
    percent,
    tooltip: `${label}: ${percent}% (${filteredMaterials.length} ${materialLabel} ${inLabel} ${filteredEntities.length} ${entityLabel} ${inLabel} ${filteredActivities.length} ${activityLabel} ${fromLabel} ${materials.length} ${materialLabel} ${inLabel} ${entities.length} ${entityLabel} ${inLabel} ${activities.length} ${activityLabel})`,
  }
}

export function buildLocationData(
  c: Context,
  locationId: number,
  locationName: string,
  filtered: InventoryDataDTO[],
  total: number,
  groupedInventories: Record<number, InventoryDataDTO[]>
) {
  const filteredMaterials = [
    ...new Set(filtered.map((data) => data.transactions_master_material_id)),
  ]
  const filteredEntities = [
    ...new Set(filtered.map((data) => data.entities_id)),
  ]
  const filteredActivities = [
    ...new Set(filtered.map((data) => data.transactions_activity_id)),
  ]

  const totalMaterials = [
    ...new Set(
      groupedInventories[locationId]?.map(
        (data) => data.transactions_master_material_id
      ) || []
    ),
  ]
  const totalEntities = [
    ...new Set(
      groupedInventories[locationId]?.map((data) => data.entities_id) || []
    ),
  ]
  const totalActivities = [
    ...new Set(
      groupedInventories[locationId]?.map(
        (data) => data.transactions_activity_id
      ) || []
    ),
  ]

  const value = filtered.length
  const percent = total > 0 ? parseFloat(((value / total) * 100).toFixed(2)) : 0

  const materialLabel = c.var.t("common.material")
  const entityLabel = c.var.t("common.entity")
  const activityLabel = c.var.t("common.activity")

  const fromLabel = c.var.t("common.from")
  const inLabel = c.var.t("common.in")

  return {
    id: locationId,
    name: locationName,
    value,
    percent,
    tooltip: `${locationName}: ${percent}% (${filteredMaterials.length} ${materialLabel} ${inLabel} ${filteredEntities.length} ${entityLabel} ${inLabel} ${filteredActivities.length} ${activityLabel} ${fromLabel} ${totalMaterials.length} ${materialLabel} ${inLabel} ${totalEntities.length} ${entityLabel} ${inLabel} ${totalActivities.length} ${activityLabel})`,
  }
}

export function buildActivityLocationData(
  c: Context,
  locationId: number,
  locationName: string,
  count: number,
  total: number
) {
  const percent = parseFloat(((count / total) * 100).toFixed(2))

  const entityLabel = c.var.t("common.entity")
  const fromLabel = c.var.t("common.from")

  return {
    id: locationId,
    name: locationName,
    value: count,
    percent,
    tooltip: `${locationName}: ${percent}% (${count} ${fromLabel} ${total} ${entityLabel})`,
  }
}

export function buildMaterialEntityList<
  T extends {
    entities_id: number | null
    entities_name: string | null
    entities_province_name: string | null
    entities_province_id: number | null
    entities_regency_name: string | null
    entities_regency_id: number | null
  },
>(
  entities: (number | null)[],
  inventoriesByEntity: Record<number, T[]>,
  statusInventories: T[]
) {
  const statusEntityIds = [
    ...new Set(statusInventories.map((d) => d.entities_id)),
  ]

  return entities
    .map((entityId) => {
      if (entityId === null || entityId === undefined) return null
      const entityData = inventoriesByEntity[entityId]?.[0]
      if (!entityData) return null

      return {
        id: entityId,
        name: entityData.entities_name,
        value: statusEntityIds.includes(entityId) ? 100 : 0,
        province: {
          id: entityData.entities_province_id,
          name: entityData.entities_province_name,
        },
        regency: {
          id: entityData.entities_regency_id,
          name: entityData.entities_regency_name,
        },
      }
    })
    .filter((e) => e !== null)
    .sort((a, b) => b!.value - a!.value)
}

export function getStatusCondition(
  transactionType: "normal" | "min" | "max" | "zero_stock"
): string {
  switch (transactionType) {
    case "normal":
      return "Normal"
    case "min":
      return "< Min"
    case "max":
      return "> Max"
    case "zero_stock":
      return "Habis"
  }
}

export function buildTemperatureLocationDataWithInventory(
  c: Context,
  locationId: number,
  locationName: string,
  count: number,
  total: number
) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0

  const fromLabel = c.var.t("common.from")
  const inventoryLabel = c.var.t("inventory_overview.inventories")

  return {
    id: locationId,
    name: locationName,
    value: count,
    percent,
    tooltip: `${locationName}: ${percent}% (${count} ${fromLabel} ${total} ${inventoryLabel})`,
  }
}
