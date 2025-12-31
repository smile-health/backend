import { Context } from "hono"
import moment from "moment"
import {
  OrderDifferenceQueryParams,
  OrderDifferenceReviewResponse,
  OrderDifferenceReviewResponseSchema,
  OrderDifferencePaginatedResponse,
  OrderDifferencePaginatedResponseSchema,
} from "./order-difference.schema.js"
import {
  processReviewData,
  processOrderDifferenceData,
  generateOrderDifferenceSeries,
} from "./order-difference.utils.js"
import { calculatePagination } from "@/common/utils/pagination.js"
import { MaterialRepository } from "../material/material.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { LocationModule } from "../location/location.module.js"
import { OrderDifferenceRepository } from "./order-difference.repository.js"
import { generatePeriods } from "@/common/utils/period.js"
import { ActivityRepository } from "../activity/activity.repository.js"
import { RegionRepository } from "../region/region.repository.js"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { OrderDifferenceExcel } from "./order-difference.excel.js"

export class OrderDifferenceModule {
  constructor(
    private readonly orderDifferenceRepository: OrderDifferenceRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly entityRepository: EntityRepository,
    private readonly locationModule: LocationModule,
    private readonly activityRepository: ActivityRepository,
    private readonly regionRepository: RegionRepository,
    private readonly entityTagRepository: EntityTagRepository,
    private readonly orderDifferenceExcel: OrderDifferenceExcel
  ) {}

  /**
   * Get review data (overview) - Chart format
   * Replicates getorderDifferenceOverviewData from old codebase
   */
  async getReview(
    c: Context,
    queryParams: OrderDifferenceQueryParams
  ): Promise<OrderDifferenceReviewResponse> {
    // Fetch order difference data
    const data = await this.orderDifferenceRepository.fetchOrderDifferenceData(
      c,
      queryParams,
      "review"
    )

    // Get last updated timestamp
    const lastUpdatedResult =
      await this.orderDifferenceRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss")

    // Generate serieses & categories based on period
    const serieses = generateOrderDifferenceSeries(
      c,
      queryParams.information_type
    )
    const categories = generatePeriods(queryParams)

    // Process data into chart format
    const dataset = processReviewData(
      c,
      data,
      queryParams,
      serieses,
      categories
    )

    const response: OrderDifferenceReviewResponse = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
      },
    }

    // Validate response against schema
    return OrderDifferenceReviewResponseSchema.parse(response)
  }

  /**
   * Get material data with pagination
   * Replicates getOrderDifferenceMaterialData from old codebase
   */
  async getMaterial(
    c: Context,
    queryParams: OrderDifferenceQueryParams,
    download = false
  ): Promise<OrderDifferencePaginatedResponse> {
    // Fetch materials with pagination (skip pagination if download=true)
    const { records: materials, count: total } =
      await this.materialRepository.fetchMaterials(c, queryParams, {
        is_paginate: !download,
      })

    // Fetch order difference data for materials
    const data = await this.orderDifferenceRepository.fetchOrderDifferenceData(
      c,
      queryParams,
      "material"
    )

    // Get last updated timestamp
    const lastUpdatedResult =
      await this.orderDifferenceRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss")

    // Generate serieses & categories for material format (with id, selector)
    const serieses = generateOrderDifferenceSeries(
      c,
      queryParams.information_type
    )
    const categories = generatePeriods(queryParams)

    // Process data by material
    const dataset = processOrderDifferenceData(
      c,
      data,
      materials,
      queryParams,
      "master_material_id",
      serieses,
      categories
    )

    // Get series labels based on information type
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

    const response: OrderDifferencePaginatedResponse = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
        type,
      },
      ...pagination,
    }

    // Validate response against schema
    return OrderDifferencePaginatedResponseSchema.parse(response)
  }

  /**
   * Get entity data with pagination
   * Replicates getOrderDifferenceEntityData from old codebase
   */
  async getEntity(
    c: Context,
    queryParams: OrderDifferenceQueryParams,
    download = false
  ): Promise<OrderDifferencePaginatedResponse> {
    // Fetch entities with pagination (skip pagination if download=true)
    const { records: entities, count: total } =
      await this.entityRepository.fetchEntities(c, queryParams, {
        is_paginate: !download,
      })

    // Fetch order difference data for entities
    const data = await this.orderDifferenceRepository.fetchOrderDifferenceData(
      c,
      queryParams,
      "entity"
    )

    // Get last updated timestamp
    const lastUpdatedResult =
      await this.orderDifferenceRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss")

    // Generate serieses & categories for entity format (now unified with id, label, selector, week_number)
    const serieses = generateOrderDifferenceSeries(
      c,
      queryParams.information_type
    )
    const categories = generatePeriods(queryParams)

    // Process data by entity
    const dataset = processOrderDifferenceData(
      c,
      data,
      entities,
      queryParams,
      "entities_id",
      serieses,
      categories
    )

    // Get series labels based on information type
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

    const response: OrderDifferencePaginatedResponse = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
        type,
      },
      ...pagination,
    }

    // Validate response against schema
    return OrderDifferencePaginatedResponseSchema.parse(response)
  }

  /**
   * Get location data with pagination
   * Replicates getOrderDifferenceLocationData from old codebase
   */
  async getLocation(
    c: Context,
    queryParams: OrderDifferenceQueryParams,
    download = false
  ): Promise<OrderDifferencePaginatedResponse> {
    // Determine location list based on geographic hierarchy (skip pagination if download=true)
    const { records: locations, count: total } =
      await this.locationModule.getLocations(c, queryParams, download)

    // Fetch order difference data for locations
    const data = await this.orderDifferenceRepository.fetchOrderDifferenceData(
      c,
      queryParams,
      "location"
    )

    // Get last updated timestamp
    const lastUpdatedResult =
      await this.orderDifferenceRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss")

    // Generate serieses & categories for location format (now unified with id, label, selector, week_number)
    const serieses = generateOrderDifferenceSeries(
      c,
      queryParams.information_type
    )
    const categories = generatePeriods(queryParams)

    // Process data by location
    const dataset = processOrderDifferenceData(
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

    const response: OrderDifferencePaginatedResponse = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
        type,
      },
      ...pagination,
    }

    // Validate response against schema
    return OrderDifferencePaginatedResponseSchema.parse(response)
  }

  /**
   * Get last updated timestamp
   */
  async getLastUpdated(): Promise<string> {
    const result = await this.orderDifferenceRepository.fetchLastUpdated()
    return result?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss")
  }

  /**
   * Export review data to Excel
   */
  async getReviewExport(c: Context, queryParams: OrderDifferenceQueryParams) {
    const reviewData = await this.getReview(c, queryParams)
    return await this.orderDifferenceExcel.generateReviewExport(
      c,
      queryParams,
      reviewData
    )
  }

  /**
   * Export material data to Excel
   */
  async getMaterialExport(c: Context, queryParams: OrderDifferenceQueryParams) {
    const materialData = await this.getMaterial(c, queryParams, true)
    return await this.orderDifferenceExcel.generateMaterialExport(
      c,
      queryParams,
      materialData
    )
  }

  /**
   * Export entity data to Excel
   */
  async getEntityExport(c: Context, queryParams: OrderDifferenceQueryParams) {
    const entityData = await this.getEntity(c, queryParams, true)
    return await this.orderDifferenceExcel.generateEntityExport(
      c,
      queryParams,
      entityData
    )
  }

  /**
   * Export location data to Excel
   */
  async getLocationExport(c: Context, queryParams: OrderDifferenceQueryParams) {
    const locationData = await this.getLocation(c, queryParams, true)
    return await this.orderDifferenceExcel.generateLocationExport(
      c,
      queryParams,
      locationData
    )
  }
}
