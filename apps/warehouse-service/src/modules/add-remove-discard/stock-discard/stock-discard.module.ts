import { Context } from "hono"
import { AddRemoveDiscardRepository } from "../add-remove-discard.repository.js"
import { TransactionReasonRepository } from "../transaction-reason.repository.js"
import {
  StockDiscardQueryParams,
  AddRemoveDiscardReviewResponseDTO,
  AddRemoveDiscardReviewResponseSchema,
  AddRemoveDiscardPaginatedResponseDTO,
  AddRemoveDiscardPaginatedResponseSchema,
} from "../add-remove-discard.schema.js"
import {
  generateSeriesFromReasons,
  processReviewData,
  processAddRemoveDiscardData,
  generateTypeFromSeries,
} from "../add-remove-discard.utils.js"
import { MaterialRepository } from "../../material/material.repository.js"
import { EntityRepository } from "../../entity/entity.repository.js"
import { generatePeriods } from "@/common/utils/period.js"
import { calculatePagination } from "@/common/utils/pagination.js"
import { LocationModule } from "../../location/location.module.js"
import { StockDiscardExcel } from "./stock-discard.excel.js"

export class StockDiscardModule {
  constructor(
    private readonly addRemoveDiscardRepository: AddRemoveDiscardRepository,
    private readonly transactionReasonRepository: TransactionReasonRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly entityRepository: EntityRepository,
    private readonly locationModule: LocationModule,
    private readonly stockDiscardExcel: StockDiscardExcel
  ) {}

  /**
   * Get review data (chart format)
   */
  async getReview(
    c: Context,
    queryParams: StockDiscardQueryParams
  ): Promise<AddRemoveDiscardReviewResponseDTO> {
    // Set transaction type to [4,9] for stock discard
    const params = { ...queryParams, transaction_type: [4, 9] }

    // Generate period categories
    const categories = generatePeriods(params)

    // Get transaction reasons for series (only tyep 4, 9)
    const reasons =
      await this.transactionReasonRepository.fetchTransactionReasons(c, params)
    const serieses = generateSeriesFromReasons(c, reasons)

    // Fetch raw data
    const data =
      await this.addRemoveDiscardRepository.fetchAddRemoveDiscardData(
        c,
        params,
        "review"
      )

    // Process data for chart format
    const dataset = processReviewData(c, data, params, serieses, categories)

    // Get last updated
    const lastUpdatedResult =
      await this.addRemoveDiscardRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || new Date().toISOString()

    const response = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
      },
    }

    return AddRemoveDiscardReviewResponseSchema.parse(response)
  }

  /**
   * Get material data (paginated format)
   */
  async getMaterial(
    c: Context,
    queryParams: StockDiscardQueryParams,
    download = false
  ): Promise<AddRemoveDiscardPaginatedResponseDTO> {
    // Set transaction type to [4,9] for stock discard
    const params = { ...queryParams, transaction_type: [4, 9] }

    // Generate period categories
    const categories = generatePeriods(params)

    // Get transaction reasons for series (only tyep 4, 9)
    const reasons =
      await this.transactionReasonRepository.fetchTransactionReasons(c, params)
    const serieses = generateSeriesFromReasons(c, reasons)
    const type = generateTypeFromSeries(serieses)

    // Fetch raw data for all materials (not just current page)
    const data =
      await this.addRemoveDiscardRepository.fetchAddRemoveDiscardData(
        c,
        params,
        "material"
      )

    // Fetch materials with pagination (skip pagination if download=true)
    const { records: materials, count: total } =
      await this.materialRepository.fetchMaterials(c, queryParams, {
        is_paginate: !download,
      })

    // Process data
    const dataset = processAddRemoveDiscardData(
      c,
      data,
      materials,
      queryParams,
      "master_material_id",
      serieses,
      categories
    )

    // Get last updated
    const lastUpdatedResult =
      await this.addRemoveDiscardRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || new Date().toISOString()

    const pagination = download
      ? {
          page: 1,
          item_per_page: total,
          total_item: total,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(total, queryParams.page, queryParams.paginate)

    const response = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
        type,
      },
      ...pagination,
    }

    return AddRemoveDiscardPaginatedResponseSchema.parse(response)
  }

  /**
   * Get entity data (paginated format)
   */
  async getEntity(
    c: Context,
    queryParams: StockDiscardQueryParams,
    download = false
  ): Promise<AddRemoveDiscardPaginatedResponseDTO> {
    // Set transaction type to [4,9] for stock discard
    const params = { ...queryParams, transaction_type: [4, 9] }

    // Generate period categories
    const categories = generatePeriods(params)

    // Get transaction reasons for series (only tyep 4, 9)
    const reasons =
      await this.transactionReasonRepository.fetchTransactionReasons(c, params)
    const serieses = generateSeriesFromReasons(c, reasons)
    const type = generateTypeFromSeries(serieses)

    // Fetch raw data for all entities (not just current page)
    const data =
      await this.addRemoveDiscardRepository.fetchAddRemoveDiscardData(
        c,
        params,
        "entity"
      )

    // Fetch entities with pagination (skip pagination if download=true)
    const { records: entities, count: total } =
      await this.entityRepository.fetchEntities(c, queryParams, {
        is_paginate: !download,
      })

    // Process data
    const dataset = processAddRemoveDiscardData(
      c,
      data,
      entities,
      params,
      "entities_id",
      serieses,
      categories
    )

    // Get last updated
    const lastUpdatedResult =
      await this.addRemoveDiscardRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || new Date().toISOString()

    const pagination = download
      ? {
          page: 1,
          item_per_page: total,
          total_item: total,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(total, queryParams.page, queryParams.paginate)

    const response = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
        type,
      },
      ...pagination,
    }

    return AddRemoveDiscardPaginatedResponseSchema.parse(response)
  }

  /**
   * Get location data (paginated format)
   */
  async getLocation(
    c: Context,
    queryParams: StockDiscardQueryParams,
    download = false
  ): Promise<AddRemoveDiscardPaginatedResponseDTO> {
    // Set transaction type to [4,9] for stock discard
    const params = { ...queryParams, transaction_type: [4, 9] }

    // Generate period categories
    const categories = generatePeriods(params)

    // Get transaction reasons for series (only tyep 4, 9)
    const reasons =
      await this.transactionReasonRepository.fetchTransactionReasons(c, params)
    const serieses = generateSeriesFromReasons(c, reasons)
    const type = generateTypeFromSeries(serieses)

    // Fetch raw data for all locations (not just current page)
    const data =
      await this.addRemoveDiscardRepository.fetchAddRemoveDiscardData(
        c,
        params,
        "location"
      )

    const { records: locations, count: total } =
      await this.locationModule.getLocations(c, queryParams, download)

    // Process data
    const dataset = processAddRemoveDiscardData(
      c,
      data,
      locations,
      params,
      "location_id",
      serieses,
      categories
    )

    // Get last updated
    const lastUpdatedResult =
      await this.addRemoveDiscardRepository.fetchLastUpdated()
    const lastUpdated =
      lastUpdatedResult?.last_updated || new Date().toISOString()

    const pagination = download
      ? {
          page: 1,
          item_per_page: total,
          total_item: total,
          total_page: 1,
          list_pagination: [1],
        }
      : calculatePagination(total, queryParams.page, queryParams.paginate)

    const response = {
      last_updated: lastUpdated,
      data: {
        categories,
        dataset,
        type,
      },
      ...pagination,
    }

    return AddRemoveDiscardPaginatedResponseSchema.parse(response)
  }

  /**
   * Export review data to Excel
   */
  async getReviewExport(c: Context, queryParams: StockDiscardQueryParams) {
    const reviewData = await this.getReview(c, queryParams)
    return await this.stockDiscardExcel.generateReviewExport(
      c,
      queryParams,
      reviewData
    )
  }

  /**
   * Export material data to Excel
   */
  async getMaterialExport(c: Context, queryParams: StockDiscardQueryParams) {
    const materialData = await this.getMaterial(c, queryParams, true)
    return await this.stockDiscardExcel.generateMaterialExport(
      c,
      queryParams,
      materialData
    )
  }

  /**
   * Export entity data to Excel
   */
  async getEntityExport(c: Context, queryParams: StockDiscardQueryParams) {
    const entityData = await this.getEntity(c, queryParams, true)
    return await this.stockDiscardExcel.generateEntityExport(
      c,
      queryParams,
      entityData
    )
  }

  /**
   * Export location data to Excel
   */
  async getLocationExport(c: Context, queryParams: StockDiscardQueryParams) {
    const locationData = await this.getLocation(c, queryParams, true)
    return await this.stockDiscardExcel.generateLocationExport(
      c,
      queryParams,
      locationData
    )
  }
}
