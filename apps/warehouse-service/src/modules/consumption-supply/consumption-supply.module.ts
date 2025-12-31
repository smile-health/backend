import { Context } from "hono"
import moment from "moment"
import {
  ConsumptionSupplyQueryParams,
  ConsumptionSupplyReviewResponse,
  ConsumptionSupplyReviewResponseSchema,
  ConsumptionSupplyPaginatedResponse,
  ConsumptionSupplyPaginatedResponseSchema,
} from "./consumption-supply.schema.js"
import {
  processReviewData,
  processConsumptionSupplyData,
  generateConsumptionSupplySeries,
} from "./consumption-supply.utils.js"
import { calculatePagination } from "@/common/utils/pagination.js"
import { MaterialRepository } from "../material/material.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { LocationModule } from "../location/location.module.js"
import { ConsumptionSupplyRepository } from "./consumption-supply.repository.js"
import { generatePeriods } from "@/common/utils/period.js"
import { ActivityRepository } from "../activity/activity.repository.js"
import { RegionRepository } from "../region/region.repository.js"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { ConsumptionSupplyExcel } from "./consumption-supply.excel.js"

export class ConsumptionSupplyModule {
  constructor(
    private readonly consumptionSupplyRepository: ConsumptionSupplyRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly entityRepository: EntityRepository,
    private readonly locationModule: LocationModule,
    private readonly activityRepository: ActivityRepository,
    private readonly regionRepository: RegionRepository,
    private readonly entityTagRepository: EntityTagRepository,
    private readonly consumptionSupplyExcel: ConsumptionSupplyExcel
  ) {}

  /**
   * Get review data (overview) - Chart format
   * Replicates getConsumptionSupplyOverviewData from old codebase
   */
  async getReview(
    c: Context,
    queryParams: ConsumptionSupplyQueryParams
  ): Promise<ConsumptionSupplyReviewResponse> {
    // Fetch consumption supply data
    const data =
      await this.consumptionSupplyRepository.fetchConsumptionSupplyData(
        c,
        queryParams,
        "review"
      )

    // Get last updated timestamp
    const lastUpdatedResult =
      await this.consumptionSupplyRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss")

    // Generate serieses & categories based on period
    const serieses = generateConsumptionSupplySeries(c, queryParams)
    const categories = generatePeriods(queryParams)

    // Process data into chart format
    const dataset = processReviewData(
      c,
      data,
      queryParams,
      serieses,
      categories
    )

    const response: ConsumptionSupplyReviewResponse = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
      },
    }

    // Validate response against schema
    return ConsumptionSupplyReviewResponseSchema.parse(response)
  }

  /**
   * Get material data with pagination
   * Replicates getConsumptionSupplyMaterialData from old codebase
   */
  async getMaterial(
    c: Context,
    queryParams: ConsumptionSupplyQueryParams,
    download = false
  ): Promise<ConsumptionSupplyPaginatedResponse> {
    // Fetch materials with pagination (skip pagination if download=true)
    const { records: materials, count: total } =
      await this.materialRepository.fetchMaterials(c, queryParams, {
        is_paginate: !download,
      })

    // Fetch consumption supply data for materials
    const data =
      await this.consumptionSupplyRepository.fetchConsumptionSupplyData(
        c,
        queryParams,
        "material"
      )

    // Get last updated timestamp
    const lastUpdatedResult =
      await this.consumptionSupplyRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss")

    // Generate serieses & categories for material format
    const serieses = generateConsumptionSupplySeries(c, queryParams)
    const categories = generatePeriods(queryParams)

    // Process data by material
    const dataset = processConsumptionSupplyData(
      c,
      data,
      materials,
      queryParams,
      "material_id",
      serieses,
      categories
    )

    // Get series labels
    const type = serieses.map((series) => ({
      key: series.key,
      label: series.label,
    }))

    // Calculate pagination (skip if download=true)
    const pagination = download
      ? {
          page: 1,
          item_per_page: total,
          total_item: total,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(total, queryParams.page, queryParams.paginate)

    const response: ConsumptionSupplyPaginatedResponse = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
        type,
      },
      ...pagination,
    }

    // Validate response against schema
    return ConsumptionSupplyPaginatedResponseSchema.parse(response)
  }

  /**
   * Get entity data with pagination
   * Replicates getConsumptionSupplyEntityData from old codebase
   */
  async getEntity(
    c: Context,
    queryParams: ConsumptionSupplyQueryParams,
    download = false
  ): Promise<ConsumptionSupplyPaginatedResponse> {
    // Fetch entities with pagination (skip pagination if download=true)
    const { records: entities, count: total } =
      await this.entityRepository.fetchEntities(c, queryParams, {
        is_paginate: !download,
      })

    // Fetch consumption supply data for entities
    const data =
      await this.consumptionSupplyRepository.fetchConsumptionSupplyData(
        c,
        queryParams,
        "entity"
      )

    // Get last updated timestamp
    const lastUpdatedResult =
      await this.consumptionSupplyRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss")

    // Generate serieses & categories for entity format
    const serieses = generateConsumptionSupplySeries(c, queryParams)
    const categories = generatePeriods(queryParams)

    // Process data by entity
    const dataset = processConsumptionSupplyData(
      c,
      data,
      entities,
      queryParams,
      "entity_id",
      serieses,
      categories
    )

    // Get series labels
    const type = serieses.map((series) => ({
      key: series.key,
      label: series.label,
    }))

    // Calculate pagination (skip if download=true)
    const pagination = download
      ? {
          page: 1,
          item_per_page: total,
          total_item: total,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(total, queryParams.page, queryParams.paginate)

    const response: ConsumptionSupplyPaginatedResponse = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
        type,
      },
      ...pagination,
    }

    // Validate response against schema
    return ConsumptionSupplyPaginatedResponseSchema.parse(response)
  }

  /**
   * Get location data with pagination
   * Replicates getConsumptionSupplyLocationData from old codebase
   */
  async getLocation(
    c: Context,
    queryParams: ConsumptionSupplyQueryParams,
    download = false
  ): Promise<ConsumptionSupplyPaginatedResponse> {
    // Determine location list based on geographic hierarchy (skip pagination if download=true)
    const { records: locations, count: total } =
      await this.locationModule.getLocations(
        c,
        {
          ...queryParams,
          has_transaction_already: 0,
        },
        download
      )

    // Fetch consumption supply data for locations
    const data =
      await this.consumptionSupplyRepository.fetchConsumptionSupplyData(
        c,
        queryParams,
        "location"
      )

    // Get last updated timestamp
    const lastUpdatedResult =
      await this.consumptionSupplyRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss")

    // Generate serieses & categories for location format
    const serieses = generateConsumptionSupplySeries(c, queryParams)
    const categories = generatePeriods(queryParams)

    // Process data by location
    const dataset = processConsumptionSupplyData(
      c,
      data,
      locations,
      queryParams,
      "location_id",
      serieses,
      categories
    )

    const type = serieses.map((series) => ({
      key: series.key,
      label: series.label,
    }))

    // Calculate pagination (skip if download=true)
    const pagination = download
      ? {
          page: 1,
          item_per_page: total,
          total_item: total,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(total, queryParams.page, queryParams.paginate)

    const response: ConsumptionSupplyPaginatedResponse = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
        type,
      },
      ...pagination,
    }

    // Validate response against schema
    return ConsumptionSupplyPaginatedResponseSchema.parse(response)
  }

  /**
   * Get last updated timestamp
   */
  async getLastUpdated(): Promise<string> {
    const result = await this.consumptionSupplyRepository.fetchLastUpdated()
    return result?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss")
  }

  /**
   * Export review data to Excel
   */
  async getReviewExport(c: Context, queryParams: ConsumptionSupplyQueryParams) {
    const reviewData = await this.getReview(c, queryParams)
    return await this.consumptionSupplyExcel.generateReviewExport(
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
    queryParams: ConsumptionSupplyQueryParams
  ) {
    const materialData = await this.getMaterial(c, queryParams, true)
    return await this.consumptionSupplyExcel.generateMaterialExport(
      c,
      queryParams,
      materialData
    )
  }

  /**
   * Export entity data to Excel
   */
  async getEntityExport(c: Context, queryParams: ConsumptionSupplyQueryParams) {
    const entityData = await this.getEntity(c, queryParams, true)
    return await this.consumptionSupplyExcel.generateEntityExport(
      c,
      queryParams,
      entityData
    )
  }

  /**
   * Export location data to Excel
   */
  async getLocationExport(
    c: Context,
    queryParams: ConsumptionSupplyQueryParams
  ) {
    const locationData = await this.getLocation(c, queryParams, true)
    return await this.consumptionSupplyExcel.generateLocationExport(
      c,
      queryParams,
      locationData
    )
  }
}
