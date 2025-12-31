import { Context } from "hono"
import _ from "lodash"
import { BaseModule } from "../../base.module.js"
import { calculatePagination } from "@/common/utils/pagination.js"
import { StockInventoryRepository } from "../stock-inventory.repository.js"
import { MaterialRepository } from "../../material/material.repository.js"
import { EntityRepository } from "../../entity/entity.repository.js"
import { RegionRepository } from "../../region/region.repository.js"
import { LocationModule } from "../../location/location.module.js"
import { FillingStockExcel } from "./filling-stock.excel.js"
import {
  FillingStockQueryParams,
  FillingStockReviewResponse,
  FillingStockEntityMaterialResponse,
  FillingStockReviewResponseSchema,
  FillingStockEntityMaterialResponseSchema,
  FillingStockReviewDataset,
  FillingStockListResponse,
  FillingStockListResponseSchema,
} from "./filling-stock.schema.js"
import {
  generatePeriodCategories,
  fillAndCalculateMissingData,
} from "../stock-inventory.utils.js"
import {
  generateFillingStockTypes,
  getFillingStockValue,
  processFillingStockData,
} from "./filling-stock.utils.js"

export class FillingStockModule extends BaseModule {
  constructor(
    private readonly repository: StockInventoryRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly entityRepository: EntityRepository,
    private readonly regionRepository: RegionRepository,
    private readonly locationModule: LocationModule,
    private readonly fillingStockExcel: FillingStockExcel
  ) {
    super()
  }

  /**
   * Get filling stock review/overview data
   * Similar to abnormal stock but with 'normal' transaction type
   */
  async getReview(
    c: Context,
    queryParams: FillingStockQueryParams
  ): Promise<FillingStockReviewResponse> {
    const { from, to, period, transaction_type, information_type } = queryParams

    // Generate period categories and durations
    const { categories, durations } = generatePeriodCategories(
      from!,
      to!,
      period
    )

    // Fetch filling stock data with transaction type filtering
    const rawStockData = await this.repository.fetchStockInventoryData(
      c,
      queryParams,
      transaction_type
    )

    // Fill missing data points and calculate missing durations
    const stockData = fillAndCalculateMissingData(
      rawStockData,
      categories,
      durations,
      period,
      transaction_type
    )

    // Get last updated timestamp
    const lastUpdated = await this.repository.getLastUpdated()

    // Build response based on transaction type and information type
    let dataset: FillingStockReviewDataset[] = []

    // Group data by period for chart visualization
    const dataGroupedByPeriod = _.groupBy(stockData, "period")

    // Calculate filling stock values for each period
    const chartData = categories.map((category) => {
      const periodData =
        dataGroupedByPeriod[category.selector || category.id || ""] || []
      const divider = _.uniqBy(
        periodData,
        (item) => `${item.entity_id}_${item.master_material_id}`
      ).length
      const value = getFillingStockValue(periodData, divider, information_type)

      return {
        label: category.label || category.selector || category.id || "",
        value: typeof value === "number" ? value : 0,
      }
    })

    // Create dataset for chart visualization
    dataset = [
      {
        label: `${transaction_type || "filling"} stock (${information_type})`,
        color: "#36A2EB", // Default color for filling stock
        data: chartData.map((item) => item.value),
      },
    ]

    const response = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
      },
    }

    return FillingStockReviewResponseSchema.parse(response)
  }

  /**
   * Get filling stock material data
   * Similar to abnormal stock but with 'normal' transaction type
   */
  async getMaterial(
    c: Context,
    queryParams: FillingStockQueryParams,
    download = false
  ): Promise<FillingStockListResponse> {
    const {
      from,
      to,
      period,
      page = 1,
      paginate = 10,
      transaction_type,
      information_type,
    } = queryParams

    // Get total count and paginated materials
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

    // Fetch filling stock data for these materials
    const rawStockData = await this.repository.fetchStockInventoryData(
      c,
      queryParams,
      transaction_type
    )

    // Fill missing data points and calculate missing durations
    const stockData = fillAndCalculateMissingData(
      rawStockData,
      categories,
      durations,
      period,
      transaction_type
    )

    // Process material data with filling stock logic
    const processedData = processFillingStockData(
      materials,
      stockData,
      categories,
      "master_material_id",
      {
        fillingInformationType: information_type,
      }
    )

    // Calculate pagination
    const pagination = calculatePagination(total, page, paginate)

    // Get last updated timestamp
    const lastUpdated = await this.repository.getLastUpdated()

    const response = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset: processedData,
        type: generateFillingStockTypes(),
      },
      ...pagination,
    }

    return FillingStockListResponseSchema.parse(response)
  }

  /**
   * Get filling stock entity data
   * Similar to abnormal stock but with 'normal' transaction type
   */
  async getEntity(
    c: Context,
    queryParams: FillingStockQueryParams,
    download = false
  ): Promise<FillingStockListResponse> {
    const {
      from,
      to,
      period,
      page = 1,
      paginate = 10,
      transaction_type,
      information_type,
    } = queryParams

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

    // Fetch filling stock data for these entities
    const rawStockData = await this.repository.fetchStockInventoryData(
      c,
      queryParams,
      transaction_type
    )

    // Fill missing data points and calculate missing durations
    const stockData = fillAndCalculateMissingData(
      rawStockData,
      categories,
      durations,
      period,
      transaction_type
    )

    // Process entity data with filling stock logic
    const processedData = processFillingStockData(
      entities,
      stockData,
      categories,
      "entity_id",
      {
        includeLocationFields: true,
        fillingInformationType: information_type,
      }
    )

    // Calculate pagination
    const pagination = calculatePagination(total, page, paginate)

    // Get last updated timestamp
    const lastUpdated = await this.repository.getLastUpdated()

    const response = {
      last_updated: lastUpdated,
      data: {
        categories: categories,
        dataset: processedData,
        type: generateFillingStockTypes(),
      },
      ...pagination,
    }

    return FillingStockListResponseSchema.parse(response)
  }

  /**
   * Get filling stock entity-material data
   * Similar to abnormal stock but with 'normal' transaction type
   */
  async getEntityMaterial(
    c: Context,
    queryParams: FillingStockQueryParams,
    download = false
  ): Promise<FillingStockEntityMaterialResponse> {
    const {
      from,
      to,
      period,
      page = 1,
      paginate = 10,
      transaction_type,
      information_type,
    } = queryParams

    // Get entities with pagination
    const entitiesResult = await this.entityRepository.fetchEntities(
      c,
      queryParams,
      { is_paginate: !download }
    )
    const total = entitiesResult.count
    const entities = Array.isArray(entitiesResult.records)
      ? entitiesResult.records
      : []

    // Get materials for column headers
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

    // Fetch filling stock data for these entities
    const rawStockData = await this.repository.fetchStockInventoryData(
      c,
      queryParams,
      transaction_type
    )

    // Fill missing data points and calculate missing durations
    const stockData = fillAndCalculateMissingData(
      rawStockData,
      categories,
      durations,
      period,
      transaction_type
    )

    // Process entity-material data with filling stock logic
    const processedData = processFillingStockData(
      entities,
      stockData,
      [], // categories not used in entity-material
      "entity_id",
      {
        materials,
        includeLocationFields: true,
        fillingInformationType: information_type,
      }
    )

    // Calculate pagination
    const pagination = calculatePagination(total, page, paginate)

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
        type: generateFillingStockTypes(),
      },
      ...pagination,
    }

    return FillingStockEntityMaterialResponseSchema.parse(response)
  }

  /**
   * Get filling stock location data
   * Similar to abnormal stock but with 'normal' transaction type
   */
  async getLocation(
    c: Context,
    queryParams: FillingStockQueryParams,
    download = false
  ): Promise<FillingStockListResponse> {
    const {
      from,
      to,
      period,
      page = 1,
      paginate = 10,
      transaction_type,
      information_type,
    } = queryParams

    // Get locations based on hierarchical logic
    const { records: locations, count: total } =
      await this.locationModule.getLocations(c, queryParams, download)

    // Generate period categories
    const { categories, durations } = generatePeriodCategories(
      from!,
      to!,
      period
    )

    // Fetch filling stock data for these locations
    const rawStockData = await this.repository.fetchStockInventoryData(
      c,
      queryParams,
      transaction_type
    )

    // Fill missing data points and calculate missing durations
    const stockData = fillAndCalculateMissingData(
      rawStockData,
      categories,
      durations,
      period,
      transaction_type
    )

    // Process location data with filling stock logic
    const processedData = processFillingStockData(
      locations,
      stockData,
      categories,
      "location_id",
      {
        includeLocationFields: true,
        fillingInformationType: information_type,
      }
    )

    // Calculate pagination
    const pagination = calculatePagination(total, page, paginate)

    // Get last updated timestamp
    const lastUpdated = await this.repository.getLastUpdated()

    const response = {
      last_updated: lastUpdated,
      data: {
        categories: categories,
        dataset: processedData,
        type: generateFillingStockTypes(),
      },
      ...pagination,
    }

    return FillingStockListResponseSchema.parse(response)
  }

  /**
   * Export review data to Excel
   */
  async getReviewExport(c: Context, queryParams: FillingStockQueryParams) {
    const reviewData = await this.getReview(c, queryParams)
    return await this.fillingStockExcel.generateReviewExport(
      c,
      queryParams,
      reviewData
    )
  }

  /**
   * Export material data to Excel
   */
  async getMaterialExport(c: Context, queryParams: FillingStockQueryParams) {
    const materialData = await this.getMaterial(c, queryParams, true)
    return await this.fillingStockExcel.generateMaterialExport(
      c,
      queryParams,
      materialData
    )
  }

  /**
   * Export entity data to Excel
   */
  async getEntityExport(c: Context, queryParams: FillingStockQueryParams) {
    const entityData = await this.getEntity(c, queryParams, true)
    return await this.fillingStockExcel.generateEntityExport(
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
    queryParams: FillingStockQueryParams
  ) {
    const entityMaterialData = await this.getEntityMaterial(
      c,
      queryParams,
      true
    )
    return await this.fillingStockExcel.generateEntityMaterialExport(
      c,
      queryParams,
      entityMaterialData
    )
  }

  /**
   * Export location data to Excel
   */
  async getLocationExport(c: Context, queryParams: FillingStockQueryParams) {
    const locationData = await this.getLocation(c, queryParams, true)
    return await this.fillingStockExcel.generateLocationExport(
      c,
      queryParams,
      locationData
    )
  }
}
