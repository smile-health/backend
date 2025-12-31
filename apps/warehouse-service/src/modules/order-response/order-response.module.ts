import { Context } from "hono"
import {
  OrderResponseQueryParams,
  OrderResponseReviewResponse,
  OrderResponsePaginatedResponse,
} from "./order-response.schema.js"
import { OrderResponseRepository } from "./order-response.repository.js"
import { MaterialRepository } from "@/modules/material/material.repository.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { LocationModule } from "@/modules/location/location.module.js"
import { generatePeriods } from "@/common/utils/period.js"
import {
  processReviewData,
  processOrderResponseData,
  generateOrderResponseSeries,
} from "./order-response.utils.js"
import { calculatePagination } from "@/common/utils/pagination.js"
import moment from "moment"
import { ActivityRepository } from "../activity/activity.repository.js"
import { RegionRepository } from "../region/region.repository.js"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { OrderResponseExcel } from "./order-response.excel.js"

export class OrderResponseModule {
  constructor(
    private readonly orderResponseRepository: OrderResponseRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly entityRepository: EntityRepository,
    private readonly locationModule: LocationModule,
    private readonly activityRepository: ActivityRepository,
    private readonly regionRepository: RegionRepository,
    private readonly entityTagRepository: EntityTagRepository,
    private readonly orderResponseExcel: OrderResponseExcel
  ) {}

  /**
   * Get review data (Tinjauan) - Overview chart data
   */
  async getReview(
    c: Context,
    queryParams: OrderResponseQueryParams
  ): Promise<OrderResponseReviewResponse> {
    const data = await this.orderResponseRepository.fetchOrderResponseData(
      c,
      queryParams,
      "review"
    )
    const lastUpdated = await this.orderResponseRepository.fetchLastUpdated()

    // Generate serieses & categories based on period
    const serieses = generateOrderResponseSeries(c)
    const categories = generatePeriods(queryParams)

    // Process data into chart format
    const dataset = processReviewData(
      c,
      data,
      queryParams,
      serieses,
      categories
    )

    return {
      last_updated:
        lastUpdated?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss"),
      data: {
        categories,
        dataset,
      },
    }
  }

  /**
   * Get material data (Per Material) with pagination
   */
  async getMaterial(
    c: Context,
    queryParams: OrderResponseQueryParams,
    download = false
  ): Promise<OrderResponsePaginatedResponse> {
    // Get paginated materials list (skip pagination if download=true)
    const materialsResult = await this.materialRepository.fetchMaterials(
      c,
      queryParams,
      { is_paginate: !download }
    )
    const materials = materialsResult.records || []
    const total = materialsResult.count || 0

    // Get order response data for materials
    const orderResponseData =
      await this.orderResponseRepository.fetchOrderResponseData(
        c,
        queryParams,
        "material"
      )

    const lastUpdated = await this.orderResponseRepository.fetchLastUpdated()

    // Generate serieses, categories, and process material data
    const serieses = generateOrderResponseSeries(c)
    const categories = generatePeriods(queryParams)

    // Process material data
    const processedData = processOrderResponseData(
      materials,
      orderResponseData,
      queryParams,
      "material_id_array",
      serieses,
      categories
    )

    // Calculate pagination (skip if download=true)
    const { page = 1, paginate = 10 } = queryParams
    const pageNum = parseInt(page.toString())
    const perPage = parseInt(paginate.toString())

    const pagination = download
      ? {
          page: 1,
          item_per_page: total,
          total_item: total,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(total, pageNum, perPage)

    return {
      last_updated:
        lastUpdated?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss"),
      data: {
        categories,
        dataset: processedData,
        type: serieses.map((series) => ({
          key: series.key,
          label: c.var.t(`order-response.series.${series.key}`),
        })),
      },
      ...pagination,
    }
  }

  /**
   * Get entity data (Per Entitas) with pagination
   */
  async getEntity(
    c: Context,
    queryParams: OrderResponseQueryParams,
    download = false
  ): Promise<OrderResponsePaginatedResponse> {
    const entities = await this.entityRepository.fetchEntities(c, queryParams, {
      is_paginate: !download,
    })
    const entitiesData = entities.records
    const entitiesTotal = entities.count

    // Get order response data for entities
    const orderResponseData =
      await this.orderResponseRepository.fetchOrderResponseData(
        c,
        queryParams,
        "entity"
      )

    const lastUpdated = await this.orderResponseRepository.fetchLastUpdated()

    // Generate serieses, categories, and process entity data
    const serieses = generateOrderResponseSeries(c)
    const categories = generatePeriods(queryParams)

    // Process entity data
    const processedData = processOrderResponseData(
      entitiesData,
      orderResponseData,
      queryParams,
      "customer_id",
      serieses,
      categories
    )

    const { page = 1, paginate = 10 } = queryParams
    const pageNum = parseInt(page.toString())
    const perPage = parseInt(paginate.toString())

    const pagination = download
      ? {
          page: 1,
          item_per_page: entitiesTotal,
          total_item: entitiesTotal,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(entitiesTotal, pageNum, perPage)

    return {
      last_updated:
        lastUpdated?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss"),
      data: {
        categories,
        dataset: processedData,
        type: serieses.map((series) => ({
          key: series.key,
          label: series.label,
        })),
      },
      ...pagination,
    }
  }

  /**
   * Get location data (Per Lokasi) with pagination
   */
  async getLocation(
    c: Context,
    queryParams: OrderResponseQueryParams,
    download = false
  ): Promise<OrderResponsePaginatedResponse> {
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

    // Get order response data for locations
    const orderResponseData =
      await this.orderResponseRepository.fetchOrderResponseData(
        c,
        queryParams,
        "location"
      )

    const lastUpdated = await this.orderResponseRepository.fetchLastUpdated()

    // Generate serieses & categories and process review data
    const serieses = generateOrderResponseSeries(c)
    const categories = generatePeriods(queryParams)

    // Process location data
    const processedData = processOrderResponseData(
      locations,
      orderResponseData,
      queryParams,
      "location_id",
      serieses,
      categories
    )

    const { page = 1, paginate = 10 } = queryParams
    const pageNum = parseInt(page.toString())
    const perPage = parseInt(paginate.toString())

    const pagination = calculatePagination(total, pageNum, perPage)

    return {
      last_updated:
        lastUpdated?.last_updated || moment().format("YYYY-MM-DD HH:mm:ss"),
      data: {
        categories,
        dataset: processedData,
        type: serieses.map((series) => ({
          key: series.key,
          label: series.label,
        })),
      },
      ...pagination,
    }
  }

  /**
   * Get last updated timestamp
   */
  async getLastUpdated(): Promise<{ last_updated: string } | null> {
    return await this.orderResponseRepository.fetchLastUpdated()
  }

  /**
   * Export review data to Excel
   */
  async getReviewExport(c: Context, queryParams: OrderResponseQueryParams) {
    const reviewData = await this.getReview(c, queryParams)
    return await this.orderResponseExcel.generateReviewExport(
      c,
      queryParams,
      reviewData
    )
  }

  /**
   * Export material data to Excel
   */
  async getMaterialExport(c: Context, queryParams: OrderResponseQueryParams) {
    const materialData = await this.getMaterial(c, queryParams, true)
    return await this.orderResponseExcel.generateMaterialExport(
      c,
      queryParams,
      materialData
    )
  }

  /**
   * Export entity data to Excel
   */
  async getEntityExport(c: Context, queryParams: OrderResponseQueryParams) {
    const entityData = await this.getEntity(c, queryParams, true)
    return await this.orderResponseExcel.generateEntityExport(
      c,
      queryParams,
      entityData
    )
  }

  /**
   * Export location data to Excel
   */
  async getLocationExport(c: Context, queryParams: OrderResponseQueryParams) {
    const locationData = await this.getLocation(c, queryParams, true)
    return await this.orderResponseExcel.generateLocationExport(
      c,
      queryParams,
      locationData
    )
  }
}
