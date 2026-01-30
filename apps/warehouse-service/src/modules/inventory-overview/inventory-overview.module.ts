import { Context } from "hono"
import moment from "moment"
import { groupBy } from "es-toolkit"
import {
  InventoryOverviewQueryParams,
  StockOverviewResponse,
  StockLocationResponse,
  ActivityOverviewResponse,
  ActivityLocationResponse,
  StockMaterialQueryParams,
  StockMaterialResponse,
  MaterialEntityQueryParams,
  MaterialEntityResponse,
  TemperatureOverviewQueryParams,
  TemperatureOverviewResponse,
  TemperatureLocationResponse,
} from "./inventory-overview.schema.js"
import { InventoryOverviewRepository } from "./inventory-overview.repository.js"
import { RegionRepository } from "../region/region.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { LocationModule } from "../location/location.module.js"
import {
  buildStockData,
  buildLocationData,
  buildMaterialEntityList,
  buildTemperatureLocationDataWithInventory,
  getStatusCondition,
} from "./inventory-overview.utils.js"
import { RegionDTO } from "../region/region.schema.js"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { round } from "@smile-health/lib/utils.js"

export class InventoryOverviewModule {
  constructor(
    private readonly inventoryOverviewRepository: InventoryOverviewRepository,
    private readonly regionRepository: RegionRepository,
    private readonly entityRepository: EntityRepository,
    private readonly locationModule: LocationModule
  ) {}

  async getStocksOverview(
    c: Context,
    queryParams: InventoryOverviewQueryParams
  ): Promise<StockOverviewResponse> {
    const inventories =
      await this.inventoryOverviewRepository.fetchInventoryData(c, queryParams)

    const lastUpdatedResult =
      await this.inventoryOverviewRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_update || moment().format("YYYY-MM-DD")

    const normalInventories = inventories.filter(
      (data) => data.status === "Normal"
    )
    const minInventories = inventories.filter(
      (data) => data.status === "< Min" || data.status === "< min"
    )
    const maxInventories = inventories.filter((data) => data.status === "> Max")
    const zeroInventories = inventories.filter(
      (data) => data.status === "Habis"
    )

    const data = [
      buildStockData(
        c,
        "Normal",
        "normal",
        true,
        normalInventories,
        inventories
      ),
      buildStockData(c, "< Min", "min", false, minInventories, inventories),
      buildStockData(c, "> Max", "max", false, maxInventories, inventories),
      buildStockData(
        c,
        "Habis",
        "zero_stock",
        false,
        zeroInventories,
        inventories
      ),
    ]

    let province
    let regency
    let mapName = "INDONESIA"

    if (queryParams.province_id) {
      const { records: provinces } = await this.regionRepository.fetchProvinces(
        c,
        queryParams
      )
      if (provinces.length > 0) {
        province = {
          id: provinces[0]?.id,
          name: provinces[0]?.name,
        }
        mapName = `${provinces[0]?.id}_${provinces[0]?.name}`
      }
    }

    if (queryParams.regency_id) {
      const { records: regencies } = await this.regionRepository.fetchRegencies(
        c,
        queryParams
      )
      if (regencies.length > 0) {
        regency = {
          id: regencies[0]?.id,
          name: regencies[0]?.name,
        }
        mapName = `${regencies[0]?.id}_${regencies[0]?.name}`
      }
    }

    return {
      current_time: moment().format("DD/MM/YYYY h:mm"),
      last_updated: lastUpdated,
      map_name: mapName,
      province,
      regency,
      data,
    }
  }

  async getStocksLocation(
    c: Context,
    queryParams: InventoryOverviewQueryParams
  ): Promise<StockLocationResponse> {
    const inventories =
      await this.inventoryOverviewRepository.fetchInventoryData(c, queryParams)

    const groupByField = "location_id"

    // Get locations using LocationModule
    const { records: locations } = await this.locationModule.getLocations(
      c,
      queryParams,
      true // no pagination
    )

    const groupedInventories = groupBy(
      inventories,
      (item) => item[groupByField] as number
    )

    const normal: Array<{
      id: number
      name: string
      value: number
      percent: number
      tooltip: string
    }> = []
    const min: Array<{
      id: number
      name: string
      value: number
      percent: number
      tooltip: string
    }> = []
    const max: Array<{
      id: number
      name: string
      value: number
      percent: number
      tooltip: string
    }> = []
    const zeroStock: Array<{
      id: number
      name: string
      value: number
      percent: number
      tooltip: string
    }> = []

    locations.forEach((location) => {
      const locationInventories = groupedInventories[location.id] || []
      const total = locationInventories.length

      if (total > 0) {
        const normalFiltered = locationInventories.filter(
          (data) => data.status === "Normal"
        )
        const minFiltered = locationInventories.filter(
          (data) => data.status === "< Min" || data.status === "< min"
        )
        const maxFiltered = locationInventories.filter(
          (data) => data.status === "> Max"
        )
        const zeroFiltered = locationInventories.filter(
          (data) => data.status === "Habis"
        )

        normal.push(
          buildLocationData(
            c,
            location.id,
            location.name,
            normalFiltered,
            total,
            groupedInventories
          )
        )
        min.push(
          buildLocationData(
            c,
            location.id,
            location.name,
            minFiltered,
            total,
            groupedInventories
          )
        )
        max.push(
          buildLocationData(
            c,
            location.id,
            location.name,
            maxFiltered,
            total,
            groupedInventories
          )
        )
        zeroStock.push(
          buildLocationData(
            c,
            location.id,
            location.name,
            zeroFiltered,
            total,
            groupedInventories
          )
        )
      }
    })

    return {
      data: {
        normal: normal.sort((a, b) => b.percent - a.percent),
        min: min.sort((a, b) => b.percent - a.percent),
        max: max.sort((a, b) => b.percent - a.percent),
        zero_stock: zeroStock.sort((a, b) => b.percent - a.percent),
      },
    }
  }

  async getStocksMaterials(
    c: Context,
    queryParams: StockMaterialQueryParams
  ): Promise<StockMaterialResponse> {
    const inventories =
      await this.inventoryOverviewRepository.fetchInventoryData(c, queryParams)

    const inventoriesGroupedByMaterial = groupBy(
      inventories,
      (item) => item.transactions_master_material_id as number
    )

    const inventoriesFilteredByType = inventories.filter(
      (item) => item.status === getStatusCondition(queryParams.transaction_type)
    )

    const inventoriesTypedGroupedByMaterial = groupBy(
      inventoriesFilteredByType,
      (item) => item.transactions_master_material_id as number
    )

    const materialIds = Object.keys(inventoriesGroupedByMaterial).map(Number)

    const data = materialIds
      .map((materialId) => {
        const materialInventories =
          inventoriesGroupedByMaterial[materialId] || []

        const allMaterials = [
          ...new Set(
            materialInventories.map((d) => d.transactions_master_material_id)
          ),
        ]
        const allEntities = [
          ...new Set(materialInventories.map((d) => d.entities_id)),
        ]
        const allActivities = [
          ...new Set(
            materialInventories.map((d) => d.transactions_activity_id)
          ),
        ]

        const materialInventoriesType =
          inventoriesTypedGroupedByMaterial[materialId] || []

        if (materialInventoriesType.length === 0) return null

        const materialName =
          materialInventoriesType[0]?.transactions_master_material_name ||
          "Unknown Material"

        const entities = [
          ...new Set(materialInventoriesType.map((d) => d.entities_id)),
        ]
        const activities = [
          ...new Set(
            materialInventoriesType.map((d) => d.transactions_activity_id)
          ),
        ]
        const materials = [
          ...new Set(
            materialInventoriesType.map(
              (d) => d.transactions_master_material_id
            )
          ),
        ]

        const value = round(
          (materialInventoriesType.length / materialInventories.length) * 100
        )

        const materialLabel = c.var.t("common.material")
        const entityLabel = c.var.t("common.entity")
        const activityLabel = c.var.t("common.activity")
        const fromLabel = c.var.t("common.from")
        const inLabel = c.var.t("common.in")

        return {
          id: materialId,
          name: materialName,
          value,
          tooltip: `${materialName}: ${value}% (${materials.length} ${materialLabel} ${inLabel} ${entities.length} ${entityLabel} ${inLabel} ${activities.length} ${activityLabel} ${fromLabel} ${allMaterials.length} ${materialLabel} ${inLabel} ${allEntities.length} ${entityLabel} ${inLabel} ${allActivities.length} ${activityLabel})`,
        }
      })
      .filter((item) => item !== null)

    return { data: data.sort((a, b) => b.value - a.value) }
  }

  async getMaterialEntities(
    c: Context,
    queryParams: MaterialEntityQueryParams
  ): Promise<MaterialEntityResponse> {
    const inventories =
      await this.inventoryOverviewRepository.fetchInventoryData(c, queryParams)

    if (inventories.length === 0) {
      return { data: [] }
    }

    const inventoriesGroupedByEntity = groupBy(
      inventories,
      (item) => item.entities_id as number
    )

    const inventoriesFilteredByMaterial = inventories.filter(
      (item) => item.transactions_master_material_id === queryParams.material_id
    )

    const entities = [
      ...new Set(inventoriesFilteredByMaterial.map((d) => d.entities_id)),
    ]

    const inventoriesMaterialFilteredByType =
      inventoriesFilteredByMaterial.filter(
        (item) =>
          item.status === getStatusCondition(queryParams.transaction_type)
      )

    const entityList = buildMaterialEntityList(
      entities,
      inventoriesGroupedByEntity,
      inventoriesMaterialFilteredByType
    )

    return { data: entityList }
  }

  async getActivitiesOverview(
    c: Context,
    queryParams: InventoryOverviewQueryParams
  ): Promise<ActivityOverviewResponse> {
    const activeEntityIds =
      await this.inventoryOverviewRepository.fetchActiveEntityIds(
        c,
        queryParams
      )

    const allEntitiesResult = await this.entityRepository.fetchEntities(
      c,
      queryParams,
      { is_paginate: false }
    )

    const activeEntities = allEntitiesResult.records.filter((e) =>
      activeEntityIds.includes(e.id)
    )
    const inactiveEntities = allEntitiesResult.records.filter(
      (e) => !activeEntityIds.includes(e.id)
    )

    const lastUpdatedResult =
      await this.inventoryOverviewRepository.fetchLastActivityUpdate()
    const lastUpdated =
      lastUpdatedResult?.last_update || moment().format("YYYY-MM-DD HH:mm:ss")

    const activeCount = activeEntities.length
    const inactiveCount = inactiveEntities.length
    const total = activeCount + inactiveCount

    const activePercent =
      total > 0 ? parseFloat(((activeCount / total) * 100).toFixed(2)) : 0
    const inactivePercent =
      total > 0 ? parseFloat(((inactiveCount / total) * 100).toFixed(2)) : 0

    let province
    let regency
    let mapName = "INDONESIA"

    if (queryParams.province_id) {
      const { records: provinces } = await this.regionRepository.fetchProvinces(
        c,
        queryParams
      )
      if (provinces.length > 0) {
        province = {
          id: provinces[0]?.id,
          name: provinces[0]?.name,
        }
        mapName = `${provinces[0]?.id}_${provinces[0]?.name}`
      }
    }

    if (queryParams.regency_id) {
      const { records: regencies } = await this.regionRepository.fetchRegencies(
        c,
        queryParams
      )
      if (regencies.length > 0) {
        regency = {
          id: regencies[0]?.id,
          name: regencies[0]?.name,
        }
        mapName = `${regencies[0]?.id}_${regencies[0]?.name}`
      }
    }

    const entityLabel = c.var.t("common.entity")
    const fromLabel = c.var.t("common.from")
    const activeLabel = c.var.t("common.active")
    const inactiveLabel = c.var.t("common.inactive")

    return {
      last_updated: lastUpdated,
      axis_name: "Activity",
      map_name: mapName,
      province,
      regency,
      data: [
        {
          name: "Active",
          type: "active",
          value: activeCount,
          percent: parseFloat(activePercent.toFixed(0)),
          tooltip: `${activeLabel}: ${activePercent}% (${activeCount} ${fromLabel} ${total} ${entityLabel})`,
        },
        {
          name: "Inactive",
          type: "inactive",
          value: inactiveCount,
          percent: parseFloat(inactivePercent.toFixed(0)),
          tooltip: `${inactiveLabel}: ${inactivePercent}% (${inactiveCount} ${fromLabel} ${total} ${entityLabel})`,
        },
      ],
    }
  }

  async getActivitiesLocation(
    c: Context,
    queryParams: InventoryOverviewQueryParams
  ): Promise<ActivityLocationResponse> {
    const activeEntityIds =
      await this.inventoryOverviewRepository.fetchActiveEntityIds(
        c,
        queryParams
      )

    const allEntitiesResult = await this.entityRepository.fetchEntities(
      c,
      queryParams,
      { is_paginate: false }
    )

    const activeEntities = allEntitiesResult.records.filter((e) =>
      activeEntityIds.includes(e.id)
    )
    const inactiveEntities = allEntitiesResult.records.filter(
      (e) => !activeEntityIds.includes(e.id)
    )

    // Determine groupByKey based on filter hierarchy
    let groupByKey: "province_id" | "regency_id" | "id" = "province_id"
    if (!queryParams.province_id && !queryParams.regency_id) {
      groupByKey = "province_id"
    } else if (queryParams.province_id && !queryParams.regency_id) {
      groupByKey = "regency_id"
    } else if (queryParams.province_id && queryParams.regency_id) {
      groupByKey = "id"
    }

    // Get locations using LocationModule
    const { records: locations } = await this.locationModule.getLocations(
      c,
      queryParams,
      true // no pagination
    )

    const groupedActive = activeEntities.reduce(
      (acc, entity) => {
        const key = entity[groupByKey]
        if (key !== null && key !== undefined) {
          if (!acc[key]) acc[key] = []
          acc[key].push(entity)
        }
        return acc
      },
      {} as Record<number, typeof activeEntities>
    )

    const groupedInactive = inactiveEntities.reduce(
      (acc, entity) => {
        const key = entity[groupByKey]
        if (key !== null && key !== undefined) {
          if (!acc[key]) acc[key] = []
          acc[key].push(entity)
        }
        return acc
      },
      {} as Record<number, typeof inactiveEntities>
    )

    const active: Array<{
      id: number
      name: string
      value: number
      percent: number
      tooltip: string
    }> = []
    const inactive: Array<{
      id: number
      name: string
      value: number
      percent: number
      tooltip: string
    }> = []

    locations.forEach((location) => {
      const activeCount = groupedActive[location.id]?.length || 0
      const inactiveCount = groupedInactive[location.id]?.length || 0
      const total = activeCount + inactiveCount

      if (total > 0) {
        const activePercent = parseFloat(
          ((activeCount / total) * 100).toFixed(2)
        )
        const inactivePercent = parseFloat(
          ((inactiveCount / total) * 100).toFixed(2)
        )

        const entityLabel = c.var.t("common.entity")
        const fromLabel = c.var.t("common.from")

        active.push({
          id: location.id,
          name: location.name,
          value: activeCount,
          percent: activePercent,
          tooltip: `${location.name}: ${activePercent}% (${activeCount} ${fromLabel} ${total} ${entityLabel})`,
        })

        inactive.push({
          id: location.id,
          name: location.name,
          value: inactiveCount,
          percent: inactivePercent,
          tooltip: `${location.name}: ${inactivePercent}% (${inactiveCount} ${fromLabel} ${total} ${entityLabel})`,
        })
      }
    })

    return {
      data: {
        active: active.sort((a, b) => b.percent - a.percent),
        inactive: inactive.sort((a, b) => b.percent - a.percent),
      },
    }
  }

  async getTemperaturesOverview(
    c: Context,
    queryParams: TemperatureOverviewQueryParams
  ): Promise<TemperatureOverviewResponse> {
    // Use optimized query that returns pre-aggregated data
    const temperatureAggregates =
      await this.inventoryOverviewRepository.fetchTemperatureData(
        c,
        queryParams
      )

    const lastUpdatedResult =
      await this.inventoryOverviewRepository.fetchLastTemperatureUpdate()
    const lastUpdated =
      lastUpdatedResult?.last_update || moment().format("YYYY-MM-DD HH:mm:ss")

    // Fetch total inventory count from denominator query
    const denominatorResult =
      await this.inventoryOverviewRepository.fetchTemperatureDenominator(
        c,
        queryParams
      )
    const totalInventory = denominatorResult.total_inventory_count

    // Find counts for each status, defaulting to 0 if not present
    const normalCount =
      temperatureAggregates.find(
        (item) => item.latest_status_excursion === "Normal"
      )?.inventory_count || 0
    const lowCount =
      temperatureAggregates.find(
        (item) => item.latest_status_excursion === "Low"
      )?.inventory_count || 0
    const highCount =
      temperatureAggregates.find(
        (item) => item.latest_status_excursion === "High"
      )?.inventory_count || 0

    // Calculate unknown as the difference from total
    const knownCount = normalCount + lowCount + highCount
    const unknownCount = Math.max(0, totalInventory - knownCount)

    const normalLabel = c.var.t("inventory_overview.normal")
    const lowLabel = c.var.t("inventory_overview.low")
    const highLabel = c.var.t("inventory_overview.high")
    const unknownLabel = c.var.t("inventory_overview.unknown")
    const inventoryLabel = c.var.t("inventory_overview.inventories")
    const fromLabel = c.var.t("common.from")

    const data = [
      {
        label: "Normal",
        type: "normal",
        is_selected: true,
        value: normalCount,
        totals: totalInventory,
        percent:
          totalInventory > 0
            ? Math.round((normalCount / totalInventory) * 100)
            : 0,
        tooltip: `${normalLabel}: ${totalInventory > 0 ? Math.round((normalCount / totalInventory) * 100) : 0}% (${normalCount} ${fromLabel} ${totalInventory} ${inventoryLabel})`,
      },
      {
        label: "Low",
        type: "low",
        is_selected: false,
        value: lowCount,
        totals: totalInventory,
        percent:
          totalInventory > 0
            ? Math.round((lowCount / totalInventory) * 100)
            : 0,
        tooltip: `${lowLabel}: ${totalInventory > 0 ? Math.round((lowCount / totalInventory) * 100) : 0}% (${lowCount} ${fromLabel} ${totalInventory} ${inventoryLabel})`,
      },
      {
        label: "High",
        type: "high",
        is_selected: false,
        value: highCount,
        totals: totalInventory,
        percent:
          totalInventory > 0
            ? Math.round((highCount / totalInventory) * 100)
            : 0,
        tooltip: `${highLabel}: ${totalInventory > 0 ? Math.round((highCount / totalInventory) * 100) : 0}% (${highCount} ${fromLabel} ${totalInventory} ${inventoryLabel})`,
      },
      {
        label: "Unknown",
        type: "unknown",
        is_selected: false,
        value: unknownCount,
        totals: totalInventory,
        percent:
          totalInventory > 0
            ? Math.round((unknownCount / totalInventory) * 100)
            : 0,
        tooltip: `${unknownLabel}: ${totalInventory > 0 ? Math.round((unknownCount / totalInventory) * 100) : 0}% (${unknownCount} ${fromLabel} ${totalInventory} ${inventoryLabel})`,
      },
    ]

    let province
    let regency
    let mapName = "INDONESIA"

    if (queryParams.province_id) {
      const { records: provinces } = await this.regionRepository.fetchProvinces(
        c,
        queryParams
      )
      if (provinces.length > 0) {
        province = {
          id: provinces[0]?.id,
          name: provinces[0]?.name,
        }
        mapName = `${provinces[0]?.id}_${provinces[0]?.name}`
      }
    }

    if (queryParams.regency_id) {
      const { records: regencies } = await this.regionRepository.fetchRegencies(
        c,
        queryParams
      )
      if (regencies.length > 0) {
        regency = {
          id: regencies[0]?.id,
          name: regencies[0]?.name,
        }
        mapName = `${regencies[0]?.id}_${regencies[0]?.name}`
      }
    }

    return {
      current_time: moment().format("DD/MM/YYYY h:mm"),
      last_updated: lastUpdated,
      map_name: mapName,
      province,
      regency,
      data,
    }
  }

  async getTemperaturesLocation(
    c: Context,
    queryParams: TemperatureOverviewQueryParams
  ): Promise<TemperatureLocationResponse> {
    // Use optimized query that returns pre-aggregated data by location
    const temperatureLocationAggregates =
      await this.inventoryOverviewRepository.fetchTemperatureLocationData(
        c,
        queryParams
      )

    // Fetch total inventory counts by location from denominator query
    const denominatorByLocation =
      await this.inventoryOverviewRepository.fetchTemperatureDenominatorByLocation(
        c,
        queryParams
      )

    // Create a map of location_id -> total_inventory_count
    const locationInventoryTotals = new Map<number, number>()
    denominatorByLocation.forEach((item) => {
      locationInventoryTotals.set(item.location_id, item.total_inventory_count)
    })

    // Get locations based on filter level
    let locations: RegionDTO = []
    const paginationOption: PaginationOption = { is_paginate: false }

    if (queryParams.province_id && queryParams.regency_id) {
      const { records: regencies } = await this.regionRepository.fetchRegencies(
        c,
        queryParams,
        paginationOption
      )
      locations = regencies
    } else if (queryParams.province_id && !queryParams.regency_id) {
      const { records: regencies } = await this.regionRepository.fetchRegencies(
        c,
        queryParams,
        paginationOption
      )
      locations = regencies
    } else {
      const { records: provinces } = await this.regionRepository.fetchProvinces(
        c,
        queryParams,
        paginationOption
      )
      locations = provinces
    }

    // Group aggregates by location
    const groupedByLocation = groupBy(
      temperatureLocationAggregates,
      (item) => item.location_id as number
    )

    const normal: Array<{
      id: number
      name: string
      value: number
      percent: number
      tooltip: string
    }> = []
    const low: Array<{
      id: number
      name: string
      value: number
      percent: number
      tooltip: string
    }> = []
    const high: Array<{
      id: number
      name: string
      value: number
      percent: number
      tooltip: string
    }> = []
    const unknown: Array<{
      id: number
      name: string
      value: number
      percent: number
      tooltip: string
    }> = []

    locations.forEach((location) => {
      const locationAggregates = groupedByLocation[location.id] || []
      const total = locationInventoryTotals.get(location.id) || 0

      const normalCount =
        locationAggregates.find(
          (item) => item.latest_status_excursion === "Normal"
        )?.inventory_count || 0
      const lowCount =
        locationAggregates.find(
          (item) => item.latest_status_excursion === "Low"
        )?.inventory_count || 0
      const highCount =
        locationAggregates.find(
          (item) => item.latest_status_excursion === "High"
        )?.inventory_count || 0

      // Calculate unknown as the difference from total
      const knownCount = normalCount + lowCount + highCount
      const unknownCount = Math.max(0, total - knownCount)

      normal.push(
        buildTemperatureLocationDataWithInventory(
          c,
          location.id,
          location.name,
          normalCount,
          total
        )
      )
      low.push(
        buildTemperatureLocationDataWithInventory(
          c,
          location.id,
          location.name,
          lowCount,
          total
        )
      )
      high.push(
        buildTemperatureLocationDataWithInventory(
          c,
          location.id,
          location.name,
          highCount,
          total
        )
      )
      unknown.push(
        buildTemperatureLocationDataWithInventory(
          c,
          location.id,
          location.name,
          unknownCount,
          total
        )
      )
    })

    return {
      data: {
        normal: normal.sort((a, b) => b.percent - a.percent),
        low: low.sort((a, b) => b.percent - a.percent),
        high: high.sort((a, b) => b.percent - a.percent),
        unknown: unknown.sort((a, b) => b.percent - a.percent),
      },
    }
  }
}
