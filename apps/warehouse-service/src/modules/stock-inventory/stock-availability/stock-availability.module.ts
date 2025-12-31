import { Context } from "hono"
import _ from "lodash"
import { BaseModule } from "../../base.module.js"
import { calculatePagination } from "@/common/utils/pagination.js"
import { StockInventoryRepository } from "../stock-inventory.repository.js"
import { MaterialRepository } from "../../material/material.repository.js"
import { EntityRepository } from "../../entity/entity.repository.js"
import { LocationModule } from "../../location/location.module.js"
import { StockAvailabilityExcel } from "./stock-availability.excel.js"
import {
  StockAvailabilityQueryParams,
  StockAvailabilityReviewResponse,
  StockAvailabilityEntityMaterialResponse,
  StockAvailabilityReviewResponseSchema,
  StockAvailabilityEntityMaterialResponseSchema,
  StockAvailabilityReviewDataset,
  StockAvailabilityListResponse,
  StockAvailabilityListResponseSchema,
} from "./stock-availability.schema.js"
import {
  generatePeriodCategories,
  fillAndCalculateMissingData,
} from "../stock-inventory.utils.js"
import { STOCK_INVENTORY_TRANSACTION_TYPE } from "@/common/constants/stock-inventory.js"
import {
  generateStockAvailabilityTypes,
  getStockAvailabilityResult,
  mutateDurationToPercentage,
  processStockAvailabilityData,
} from "./stock-availability.utils.js"

export class StockAvailabilityModule extends BaseModule {
  constructor(
    private readonly repository: StockInventoryRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly entityRepository: EntityRepository,
    private readonly locationModule: LocationModule,
    private readonly stockAvailabilityExcel: StockAvailabilityExcel
  ) {
    super()
  }

  /**
   * Get stock availability review/overview data
   * Replaces the old stockAvailabilityOveriew function
   */
  async getReview(
    c: Context,
    queryParams: StockAvailabilityQueryParams
  ): Promise<StockAvailabilityReviewResponse> {
    const { from, to, period = "month", information_type = "1" } = queryParams
    const informationType = parseInt(information_type)

    // Generate period categories and durations
    const { categories, durations } = generatePeriodCategories(
      from!,
      to!,
      period
    )

    // Fetch stock availability data
    const rawStockData = await this.repository.fetchStockInventoryData(
      c,
      queryParams,
      STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY
    )

    // Fill missing data points and calculate missing durations
    const stockData = fillAndCalculateMissingData(
      rawStockData,
      categories,
      durations,
      period,
      STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY
    )

    // Convert duration to percentage
    const mutatedData = mutateDurationToPercentage(
      stockData,
      categories,
      durations
    )

    // Group data by period and calculate overview
    const dataGroupedByPeriod = _.groupBy(mutatedData, "period")

    const overview = getStockAvailabilityResult(
      dataGroupedByPeriod,
      categories,
      informationType
    )

    // Get last updated timestamp
    const lastUpdated = await this.repository.getLastUpdated()

    // Build response based on information type
    let dataset: StockAvailabilityReviewDataset[] = []

    if (informationType === 1) {
      // Availability data
      dataset = [
        {
          label: c.var.t("common.overview"),
          color: "purple",
          data: overview.map((item) => item.availability || 0),
        },
      ]
    } else {
      // Percentage proportion data
      dataset = [
        {
          label: "90-100%",
          color: "#10B981",
          data: overview.map((item) => item["90-100"] || 0),
        },
        {
          label: "70-89%",
          color: "#F59E0B",
          data: overview.map((item) => item["70-89"] || 0),
        },
        {
          label: "50-69%",
          color: "#EF4444",
          data: overview.map((item) => item["50-69"] || 0),
        },
        {
          label: "<50%",
          color: "#6B7280",
          data: overview.map((item) => item["<50"] || 0),
        },
      ]
    }

    const response = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
      },
    }

    return StockAvailabilityReviewResponseSchema.parse(response)
  }

  /**
   * Get stock availability material data
   * Replaces the old stockAvailabilityMaterial function
   */
  async getMaterial(
    c: Context,
    queryParams: StockAvailabilityQueryParams,
    download = false
  ): Promise<StockAvailabilityListResponse> {
    const {
      from,
      to,
      period = "month",
      information_type = "1",
      page = 1,
      paginate = 10,
    } = queryParams
    const informationType = parseInt(information_type)

    // Get total count and paginated materials (skip pagination if download=true)
    const materialsResult = await this.materialRepository.fetchMaterials(
      c,
      queryParams,
      { is_paginate: !download }
    )
    const total = materialsResult.count
    const materials = Array.isArray(materialsResult.records)
      ? materialsResult.records
      : []

    // Generate period categories
    const { categories, durations } = generatePeriodCategories(
      from!,
      to!,
      period
    )

    // Fetch stock availability data for these materials
    const rawStockData = await this.repository.fetchStockInventoryData(
      c,
      queryParams,
      STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY
    )

    // Fill missing data points and calculate missing durations
    const stockData = fillAndCalculateMissingData(
      rawStockData,
      categories,
      durations,
      period,
      STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY
    )

    // Convert duration to percentage
    const mutatedData = mutateDurationToPercentage(
      stockData,
      categories,
      durations
    )

    // Process material data
    const processedData = processStockAvailabilityData(
      materials,
      mutatedData,
      categories,
      "master_material_id",
      informationType
    )

    // Calculate pagination (skip if download=true)
    const pagination = download
      ? {
          page: 1,
          item_per_page: total,
          total_item: total,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(total, page, paginate)

    // Get last updated timestamp
    const lastUpdated = await this.repository.getLastUpdated()

    const response = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset: processedData,
        type: generateStockAvailabilityTypes(c, informationType),
      },
      ...pagination,
    }

    return StockAvailabilityListResponseSchema.parse(response)
  }

  /**
   * Get stock availability entity data
   * Replaces the old stockAvailabilityEntity function
   */
  async getEntity(
    c: Context,
    queryParams: StockAvailabilityQueryParams,
    download = false
  ): Promise<StockAvailabilityListResponse> {
    const {
      from,
      to,
      period,
      page = 1,
      paginate = 10,
      information_type = "1",
    } = queryParams
    const informationType = parseInt(information_type)

    // Get entities with pagination
    const { records: entities, count: total } =
      await this.entityRepository.fetchEntities(c, queryParams, {
        is_paginate: !download,
      })

    // Generate period categories
    const { categories, durations } = generatePeriodCategories(
      from!,
      to!,
      period
    )

    // Fetch stock availability data for these entities
    const rawStockData = await this.repository.fetchStockInventoryData(
      c,
      queryParams,
      STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY
    )

    // Fill missing data points and calculate missing durations
    const stockData = fillAndCalculateMissingData(
      rawStockData,
      categories,
      durations,
      period,
      STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY
    )

    // Convert duration to percentage
    const mutatedData = mutateDurationToPercentage(
      stockData,
      categories,
      durations
    )

    // Process entity data
    const processedData = processStockAvailabilityData(
      entities,
      mutatedData,
      categories,
      "entity_id",
      informationType,
      { includeLocationFields: true }
    )

    // Calculate pagination (skip if download=true)
    const pagination = download
      ? {
          page: 1,
          item_per_page: total,
          total_item: total,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(total, page, paginate)

    // Get last updated timestamp
    const lastUpdated = await this.repository.getLastUpdated()

    const response = {
      last_updated: lastUpdated,
      data: {
        categories: categories,
        dataset: processedData,
        type: generateStockAvailabilityTypes(c, informationType),
      },
      ...pagination,
    }

    return StockAvailabilityListResponseSchema.parse(response)
  }

  /**
   * Get stock availability entity-material data
   * Replaces the old stockAvailabilityEntityMaterial function
   */
  async getEntityMaterial(
    c: Context,
    queryParams: StockAvailabilityQueryParams,
    download = false
  ): Promise<StockAvailabilityEntityMaterialResponse> {
    const {
      from,
      to,
      period = "month",
      information_type = "1",
      page = 1,
      paginate = 10,
    } = queryParams
    const informationType = parseInt(information_type)

    // Get total count and paginated entities (skip pagination if download=true)
    const entitiesResult = await this.entityRepository.fetchEntities(
      c,
      queryParams,
      { is_paginate: !download }
    )
    const total = entitiesResult.count
    const entities = Array.isArray(entitiesResult.records)
      ? entitiesResult.records
      : []

    // Fetch materials without pagination for entity-material cross-analysis
    const materialsResult = await this.materialRepository.fetchMaterials(
      c,
      queryParams,
      { is_paginate: false }
    )
    const materials = Array.isArray(materialsResult.records)
      ? materialsResult.records
      : []

    // Generate period categories
    const { categories, durations } = generatePeriodCategories(
      from!,
      to!,
      period
    )

    // Fetch stock availability data for these entities
    const rawStockData = await this.repository.fetchStockInventoryData(
      c,
      queryParams,
      STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY
    )

    // Fill missing data points and calculate missing durations
    const stockData = fillAndCalculateMissingData(
      rawStockData,
      categories,
      durations,
      period,
      STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY
    )

    // Convert duration to percentage
    const mutatedData = mutateDurationToPercentage(
      stockData,
      categories,
      durations
    )

    // Process entity-material data
    const processedData = processStockAvailabilityData(
      entities,
      mutatedData,
      [], // categories not used in entity-material
      "entity_id",
      informationType,
      { materials, includeLocationFields: true }
    )

    // Calculate pagination (skip if download=true)
    const pagination = download
      ? {
          page: 1,
          item_per_page: total,
          total_item: total,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(total, page, paginate)

    // Get last updated timestamp
    const lastUpdated = await this.repository.getLastUpdated()

    // Build material columns for response
    const materialColumns = materials.map((material) => ({
      id: material.id,
      label: material.name,
    }))

    const response = {
      last_updated: lastUpdated,
      data: {
        categories: materialColumns,
        dataset: processedData,
        type: generateStockAvailabilityTypes(c, informationType),
      },
      ...pagination,
    }

    return StockAvailabilityEntityMaterialResponseSchema.parse(response)
  }

  /**
   * Get stock availability location data
   * Replaces the old stockAvailabilityLocation function
   */
  async getLocation(
    c: Context,
    queryParams: StockAvailabilityQueryParams,
    download = false
  ): Promise<StockAvailabilityListResponse> {
    const {
      from,
      to,
      period = "month",
      information_type = "1",
      page = 1,
      paginate = 10,
    } = queryParams
    const informationType = parseInt(information_type)

    const { records: locations, count: total } =
      await this.locationModule.getLocations(c, queryParams, download)

    // Generate period categories
    const { categories, durations } = generatePeriodCategories(
      from!,
      to!,
      period
    )

    // Fetch stock availability data for these locations
    const rawStockData = await this.repository.fetchStockInventoryData(
      c,
      queryParams,
      STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY
    )

    // Fill missing data points and calculate missing durations
    const stockData = fillAndCalculateMissingData(
      rawStockData,
      categories,
      durations,
      period,
      STOCK_INVENTORY_TRANSACTION_TYPE.AVAILABILITY
    )

    // Convert duration to percentage
    const mutatedData = mutateDurationToPercentage(
      stockData,
      categories,
      durations
    )

    // Process location data
    const processedData = processStockAvailabilityData(
      locations,
      mutatedData,
      categories,
      "location_id",
      informationType,
      { includeLocationFields: true }
    )

    // Calculate pagination (skip if download=true)
    const pagination = download
      ? {
          page: 1,
          item_per_page: total,
          total_item: total,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(total, page, paginate)

    // Get last updated timestamp
    const lastUpdated = await this.repository.getLastUpdated()

    const response = {
      last_updated: lastUpdated,
      data: {
        categories: categories,
        dataset: processedData,
        type: generateStockAvailabilityTypes(c, informationType),
      },
      ...pagination,
    }

    return StockAvailabilityListResponseSchema.parse(response)
  }

  /**
   * Export review data to Excel
   */
  async getReviewExport(c: Context, queryParams: StockAvailabilityQueryParams) {
    const reviewData = await this.getReview(c, queryParams)
    return await this.stockAvailabilityExcel.generateReviewExport(
      c,
      queryParams,
      reviewData
    )
  }

  /**
   * Export material data to Excel
   */
  async getMaterialExport(
    c: Context,
    queryParams: StockAvailabilityQueryParams
  ) {
    const materialData = await this.getMaterial(c, queryParams, true)
    return await this.stockAvailabilityExcel.generateMaterialExport(
      c,
      queryParams,
      materialData
    )
  }

  /**
   * Export entity data to Excel
   */
  async getEntityExport(c: Context, queryParams: StockAvailabilityQueryParams) {
    const entityData = await this.getEntity(c, queryParams, true)
    return await this.stockAvailabilityExcel.generateEntityExport(
      c,
      queryParams,
      entityData
    )
  }

  /**
   * Export entity-material data to Excel
   */
  async getEntityMaterialExport(
    c: Context,
    queryParams: StockAvailabilityQueryParams
  ) {
    const entityMaterialData = await this.getEntityMaterial(
      c,
      queryParams,
      true
    )
    return await this.stockAvailabilityExcel.generateEntityMaterialExport(
      c,
      queryParams,
      entityMaterialData
    )
  }

  /**
   * Export location data to Excel
   */
  async getLocationExport(
    c: Context,
    queryParams: StockAvailabilityQueryParams
  ) {
    const locationData = await this.getLocation(c, queryParams, true)
    return await this.stockAvailabilityExcel.generateLocationExport(
      c,
      queryParams,
      locationData
    )
  }
}
