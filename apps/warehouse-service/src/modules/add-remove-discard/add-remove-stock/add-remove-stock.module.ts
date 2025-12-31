import { Context } from "hono"
import { AddRemoveDiscardRepository } from "../add-remove-discard.repository.js"
import { TransactionReasonRepository } from "../transaction-reason.repository.js"
import {
  AddRemoveStockQueryParams,
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
import { AddRemoveStockExcel } from "./add-remove-stock.excel.js"

export class AddRemoveStockModule {
  constructor(
    private readonly addRemoveDiscardRepository: AddRemoveDiscardRepository,
    private readonly transactionReasonRepository: TransactionReasonRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly entityRepository: EntityRepository,
    private readonly locationModule: LocationModule,
    private readonly addRemoveStockExcel: AddRemoveStockExcel
  ) {}

  /**
   * Get review data (chart format)
   */
  async getReview(
    c: Context,
    queryParams: AddRemoveStockQueryParams
  ): Promise<AddRemoveDiscardReviewResponseDTO> {
    // Generate period categories
    const categories = generatePeriods(queryParams)

    // Get transaction reasons for series (types 7 and 8)
    const reasons =
      await this.transactionReasonRepository.fetchTransactionReasons(
        c,
        queryParams
      )
    const serieses = generateSeriesFromReasons(c, reasons)

    // Fetch raw data
    const data =
      await this.addRemoveDiscardRepository.fetchAddRemoveDiscardData(
        c,
        queryParams,
        "review"
      )

    // Process data for chart format
    const dataset = processReviewData(
      c,
      data,
      queryParams,
      serieses,
      categories
    )

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
    queryParams: AddRemoveStockQueryParams,
    download = false
  ): Promise<AddRemoveDiscardPaginatedResponseDTO> {
    // Generate period categories
    const categories = generatePeriods(queryParams)

    // Get transaction reasons for series (types 7 and 8)
    const reasons =
      await this.transactionReasonRepository.fetchTransactionReasons(
        c,
        queryParams
      )
    const serieses = generateSeriesFromReasons(c, reasons)
    const type = generateTypeFromSeries(serieses)

    // Fetch raw data for all materials (not just current page)
    const data =
      await this.addRemoveDiscardRepository.fetchAddRemoveDiscardData(
        c,
        queryParams,
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
    queryParams: AddRemoveStockQueryParams,
    download = false
  ): Promise<AddRemoveDiscardPaginatedResponseDTO> {
    // Generate period categories
    const categories = generatePeriods(queryParams)

    // Get transaction reasons for series (types 7 and 8)
    const reasons =
      await this.transactionReasonRepository.fetchTransactionReasons(
        c,
        queryParams
      )
    const serieses = generateSeriesFromReasons(c, reasons)
    const type = generateTypeFromSeries(serieses)

    // Fetch raw data for all entities (not just current page)
    const data =
      await this.addRemoveDiscardRepository.fetchAddRemoveDiscardData(
        c,
        queryParams,
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
      queryParams,
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
    queryParams: AddRemoveStockQueryParams,
    download = false
  ): Promise<AddRemoveDiscardPaginatedResponseDTO> {
    // Generate period categories
    const categories = generatePeriods(queryParams)

    // Get transaction reasons for series (types 7 and 8)
    const reasons =
      await this.transactionReasonRepository.fetchTransactionReasons(
        c,
        queryParams
      )
    const serieses = generateSeriesFromReasons(c, reasons)
    const type = generateTypeFromSeries(serieses)

    // Fetch raw data for all locations (not just current page)
    const data =
      await this.addRemoveDiscardRepository.fetchAddRemoveDiscardData(
        c,
        queryParams,
        "location"
      )

    const { records: locations, count: total } =
      await this.locationModule.getLocations(c, queryParams, download)

    // Process data
    const dataset = processAddRemoveDiscardData(
      c,
      data,
      locations,
      queryParams,
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
  async getReviewExport(c: Context, queryParams: AddRemoveStockQueryParams) {
    const reviewData = await this.getReview(c, queryParams)
    return await this.addRemoveStockExcel.generateReviewExport(
      c,
      queryParams,
      reviewData
    )
  }

  /**
   * Export material data to Excel
   */
  async getMaterialExport(c: Context, queryParams: AddRemoveStockQueryParams) {
    const materialData = await this.getMaterial(c, queryParams, true)
    return await this.addRemoveStockExcel.generateMaterialExport(
      c,
      queryParams,
      materialData
    )
  }

  /**
   * Export entity data to Excel
   */
  async getEntityExport(c: Context, queryParams: AddRemoveStockQueryParams) {
    const entityData = await this.getEntity(c, queryParams, true)
    return await this.addRemoveStockExcel.generateEntityExport(
      c,
      queryParams,
      entityData
    )
  }

  /**
   * Export location data to Excel
   */
  async getLocationExport(c: Context, queryParams: AddRemoveStockQueryParams) {
    const locationData = await this.getLocation(c, queryParams, true)
    return await this.addRemoveStockExcel.generateLocationExport(
      c,
      queryParams,
      locationData
    )
  }
}
