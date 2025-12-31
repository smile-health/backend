import { MasterDataRepository } from "@/common/repositories/master-data.repository.js"
import { getExportLocationFileName } from "@/common/utils/export.js"
import WarehouseTemplate from "@smile/lib/excel/warehouse-template.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { groupBy, sumBy } from "es-toolkit"
import { Context } from "hono"
import { z } from "zod"
import { AssetInventoryExcel } from "./asset-inventory.excel.js"
import { AssetInventoryRepository } from "./asset-inventory.repository.js"
import {
  AssetInventoryOverviewDataSchema,
  AssetInventoryOverviewResponse,
  AssetInventoryQueryParams,
} from "./asset-inventory.schema.js"

export class AssetInventoryModule {
  constructor(
    private readonly assetInventoryRepository: AssetInventoryRepository,
    private readonly masterDataRepository: MasterDataRepository,
    private readonly assetInventoryExcel: AssetInventoryExcel
  ) {}

  /**
   * Get asset ownership overview data
   */
  async getAssetOwnershipOverview(
    c: Context,
    queryParams: AssetInventoryQueryParams,
    withTotal = true
  ): Promise<AssetInventoryOverviewResponse> {
    const config =
      await this.assetInventoryRepository.getAssetInventoryDashboardConfig()
    queryParams.rtmd_type_id = config.rtmd_type_id

    const [data, assetTypes] = await Promise.all([
      this.assetInventoryRepository.fetchAssetOwnershipOverview(c, queryParams),
      queryParams.type_ids
        ? this.masterDataRepository.fetchDataByIds(
            "asset_type",
            queryParams.type_ids
          )
        : this.masterDataRepository.fetchAllData("asset_type"),
    ])

    const groupedByEntityTag = groupBy(data, (item) => item.element_id)

    const resultData = config.tabs.map((tab) => {
      const details = assetTypes.map((assetType, index) => {
        const assetsForEntityTag = tab.entity_tag_ids.flatMap(
          (tagId) => groupedByEntityTag[tagId] || []
        )
        const assetQty = sumBy(
          assetsForEntityTag.filter((asset) => asset.type_id === assetType.id),
          (asset) => asset.qty
        )

        return {
          id: assetType.id,
          title: withTotal ? `Total ${assetType.name}` : assetType.name,
          total: assetQty,
          color: config.card_colors[
            index % config.card_colors.length
          ] as string,
        }
      })

      // Calculate "Total Aset" for the entity type
      const totalAset = sumBy(details, (detail) => detail.total)

      const id = tab.entity_tag_ids[0]
      return {
        id: id,
        title: c.var.t(tab.title),
        total: totalAset,
        details: details,
      }
    }) as z.infer<typeof AssetInventoryOverviewDataSchema>[]

    if (!withTotal) {
      return {
        date: new Date().toISOString(),
        data: resultData,
      }
    }

    // Calculate "All" data with summed details across all tabs
    const allDetails = assetTypes.map((assetType, index) => {
      const total = resultData.reduce((sum, tab) => {
        const detail = tab.details.find((d) => d.id === assetType.id)
        return sum + (detail?.total || 0)
      }, 0)

      return {
        id: assetType.id,
        title: withTotal ? `Total ${assetType.name}` : assetType.name,
        total,
        color: config.card_colors[index % config.card_colors.length] as string,
      }
    })

    const allTotal = sumBy(allDetails, (detail) => detail.total)

    const allData = {
      id: 0,
      title: c.var.t("dashboard.asset_inventory.label.all_entity_levels"),
      total: allTotal,
      details: allDetails,
    } as z.infer<typeof AssetInventoryOverviewDataSchema>

    return {
      date: new Date().toISOString(),
      data: [allData, ...resultData],
    }
  }

  async getAssetOwnershipTable(
    c: Context,
    queryParams: AssetInventoryQueryParams
  ) {
    const config =
      await this.assetInventoryRepository.getAssetInventoryDashboardConfig()
    queryParams.rtmd_type_id = config.rtmd_type_id

    const { parents, children, total } =
      await this.assetInventoryRepository.fetchAssetOwnershipEntities(
        c,
        queryParams
      )

    const [assetTypes] = await Promise.all([
      queryParams.type_ids
        ? this.masterDataRepository.fetchDataByIds(
            "asset_type",
            queryParams.type_ids
          )
        : this.masterDataRepository.fetchAllData("asset_type"),
    ])

    const mapDetails = (entities: typeof parents) => {
      return entities.map((entity) => {
        const details = assetTypes.map((assetType) => {
          const assetQty = entity.qty_by_type[String(assetType.id)] || 0

          return {
            id: assetType.id,
            title: assetType.name,
            total: assetQty,
          }
        })

        const total = sumBy(details, (detail) => detail.total)

        return {
          id: entity.id,
          title: c.var.t(entity.name ?? "Unknown"),
          total: total,
          details: details,
        }
      }) as z.infer<typeof AssetInventoryOverviewDataSchema>[]
    }

    const parentResultData = mapDetails(parents)
    const childResultData = mapDetails(children)

    const paginatedResult = new PaginatedResponse(
      queryParams,
      [...parentResultData, ...childResultData],
      total
    )

    return {
      date: new Date().toISOString(),
      ...paginatedResult,
    }
  }

  async exportAssetInventoryExcel(
    c: Context,
    queryParams: AssetInventoryQueryParams
  ) {
    const config =
      await this.assetInventoryRepository.getAssetInventoryDashboardConfig()
    queryParams.rtmd_type_id = config.rtmd_type_id

    // Fetch table data without pagination
    const tableQueryParams = { ...queryParams, is_paginate: false }
    const { parents, children } =
      await this.assetInventoryRepository.fetchAssetOwnershipEntities(c, {
        ...tableQueryParams,
        paginate: -1,
      })

    const [assetTypes] = await Promise.all([
      queryParams.type_ids
        ? this.masterDataRepository.fetchDataByIds(
            "asset_type",
            queryParams.type_ids
          )
        : this.masterDataRepository.fetchAllData("asset_type"),
    ])

    const mapDetails = (entities: typeof parents) => {
      return entities.map((entity) => {
        const details = assetTypes.map((assetType) => {
          const assetQty = entity.qty_by_type[String(assetType.id)] || 0

          return {
            id: assetType.id,
            title: assetType.name,
            total: assetQty,
          }
        })

        const total = sumBy(details, (detail) => detail.total)

        return {
          id: entity.id,
          title: c.var.t(entity.name ?? "Unknown"),
          total: total,
          details: details,
        }
      }) as z.infer<typeof AssetInventoryOverviewDataSchema>[]
    }

    const parentResultData = mapDetails(parents)
    const childResultData = mapDetails(children)

    const tableData = {
      date: new Date().toISOString(),
      data: [...parentResultData, ...childResultData],
    }

    // Fetch overview data
    const overviewData = await this.getAssetOwnershipOverview(
      c,
      queryParams,
      false
    )

    // Generate filters
    const filters = await this.assetInventoryExcel.generateFilters(
      c,
      queryParams
    )

    // Build export options for both sheets
    const options = this.assetInventoryExcel.buildAssetInventoryExportOptions(
      c,
      tableData,
      overviewData,
      filters
    )

    // Generate Excel file with multiple sheets
    const template = new WarehouseTemplate()
    const MAX_FILTER_ROWS = 10
    await template.initWorkbook()

    for (const option of options) {
      template.initSheet(option.sheetName)
      template.setTitleBar(option.sheetName, option.columns, option.titleBar)
      template.setFilters(option.sheetName, option.filters, MAX_FILTER_ROWS)
      template.setColumns(option.columns, undefined, option.sheetName)
      template.addRows(option.sheetName, option.data)
    }

    const locationLabel = getExportLocationFileName(c, queryParams, filters)
    const fileName = `Asset Ownership - ${locationLabel}`
    template.setTitle(fileName)

    return await template.generate()
  }
}
