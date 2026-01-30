import { Context } from "hono"

import WarehouseTemplate from "@smile-health/lib/excel/warehouse-template.js"
import { Column, Filter } from "@smile-health/lib/excel/types.js"
import { ExcelExportOption } from "@/common/types/excel.js"
import { getExportLocationFileName } from "@/common/utils/export.js"
import {
  AddRemoveDiscardPaginatedResponseDTO,
  AddRemoveDiscardReviewResponseDTO,
  StockDiscardQueryParams,
} from "../add-remove-discard.schema.js"

export class StockDiscardExcel {
  constructor() {}

  /**
   * Generate review export to Excel
   */
  async generateReviewExport(
    c: Context,
    queryParams: StockDiscardQueryParams,
    reviewData: AddRemoveDiscardReviewResponseDTO
  ) {
    // Transform chart data to tabular format for Excel
    const { categories, dataset } = reviewData.data
    const data = categories.map((category, index) => {
      const row: Record<string, number | string> = {
        no: index + 1,
        period: category.label,
      }

      // Add each series data as columns
      dataset.forEach((series) => {
        row[series.label] = series.data[index] || 0
      })

      return row
    })

    // Generate columns based on series
    const columns: Column[] = [
      { key: "no", header: "No.", width: 10 },
      { key: "period", header: c.var.t("common.period"), width: 20 },
    ]

    dataset.forEach((series) => {
      columns.push({
        key: series.label,
        header: series.label,
        width: 20,
      })
    })

    const filters = await this.generateFilters(c, queryParams)

    const option: ExcelExportOption = {
      sheetName: c.var.t("common.overview"),
      titleBar: `${c.var.t("stock-discard.sheet.title")} ${c.var.t("common.overview")}`,
      filters,
      columns,
      data,
    }

    const locationLabel = getExportLocationFileName(c, queryParams, filters)
    const template = new WarehouseTemplate()
    await template.initWorkbook()

    template.initSheet(option.sheetName)
    template.setTitleBar(option.sheetName, option.columns, option.titleBar)
    template.setFilters(option.sheetName, option.filters)
    template.setColumns(option.columns, undefined, option.sheetName)
    template.addRows(option.sheetName, option.data)

    template.setTitle(
      `${option.titleBar} ${locationLabel} ${queryParams.from} - ${queryParams.to}`
    )
    return await template.generate()
  }

  /**
   * Generate material export to Excel
   */
  async generateMaterialExport(
    c: Context,
    queryParams: StockDiscardQueryParams,
    materialData: AddRemoveDiscardPaginatedResponseDTO
  ) {
    // Transform data to tabular format for Excel with hierarchical structure
    const { categories, dataset, type } = materialData.data
    const data: Record<string, number | string>[] = []

    dataset.forEach((material, materialIndex) => {
      const row: Record<string, number | string> = {
        no: materialIndex + 1,
        material_name: material.name,
      }

      // Add period data for each transaction reason type
      categories.forEach((category, categoryIndex) => {
        type.forEach((reasonType) => {
          const periodData = material.period[categoryIndex]
          const value = periodData ? periodData[reasonType.key] || 0 : 0
          row[`${reasonType.key}_${category.label}`] = value
        })
      })

      data.push(row)
    })

    // Generate columns
    const columns: Column[] = [
      { key: "no", header: "No.", width: 10 },
      { key: "material_name", header: c.var.t("common.material"), width: 30 },
    ]

    // Add hierarchical columns for each period and transaction reason
    categories.forEach((category) => {
      type.forEach((reasonType) => {
        columns.push({
          key: `${reasonType.key}_${category.label}`,
          header: `${category.label} - ${reasonType.label}`,
          width: 15,
        })
      })
    })

    const filters = await this.generateFilters(c, queryParams)

    const option: ExcelExportOption = {
      sheetName: c.var.t("common.material"),
      titleBar: `${c.var.t("stock-discard.sheet.title")} ${c.var.t("common.material")}`,
      filters,
      columns,
      data,
    }

    const locationLabel = getExportLocationFileName(c, queryParams, filters)
    const template = new WarehouseTemplate()
    await template.initWorkbook()

    template.initSheet(option.sheetName)
    template.setTitleBar(option.sheetName, option.columns, option.titleBar)
    template.setFilters(option.sheetName, option.filters)
    template.setColumns(option.columns, undefined, option.sheetName)
    template.addRows(option.sheetName, option.data)

    template.setTitle(
      `${option.titleBar} ${locationLabel} ${queryParams.from} - ${queryParams.to}`
    )
    return await template.generate()
  }

  /**
   * Generate entity export to Excel
   */
  async generateEntityExport(
    c: Context,
    queryParams: StockDiscardQueryParams,
    entityData: AddRemoveDiscardPaginatedResponseDTO
  ) {
    // Generate dynamic columns based on periods and series
    const { categories, dataset, type } = entityData.data
    const columns: Column[] = [
      { key: "no", header: "No.", width: 10 },
      { key: "province_name", header: c.var.t("common.province"), width: 20 },
      { key: "regency_name", header: c.var.t("common.regency"), width: 20 },
      { key: "entity_id", header: c.var.t("common.entity_id"), width: 15 },
      { key: "entity_name", header: c.var.t("common.entity"), width: 30 },
    ]

    // Add period columns with series subcolumns
    categories.forEach((category) => {
      type.forEach((seriesType) => {
        columns.push({
          key: `${category.id}_${seriesType.key}`,
          header: `${category.label} - ${seriesType.label}`,
          width: 15,
        })
      })
    })

    // Transform data for Excel
    const data = dataset.map((item, index) => {
      const row: Record<string, number | string> = {
        no: index + 1,
        province_name: item.province_name || "",
        regency_name: item.regency_name || "",
        entity_id: item.id,
        entity_name: item.name,
      }

      // Add period data
      categories.forEach((category, categoryIndex) => {
        type.forEach((seriesType) => {
          const periodData = item.period[categoryIndex]
          const value = periodData ? periodData[seriesType.key] || 0 : 0
          row[`${category.id}_${seriesType.key}`] = value
        })
      })

      return row
    })

    const filters = await this.generateFilters(c, queryParams)

    const option: ExcelExportOption = {
      sheetName: c.var.t("common.entity"),
      titleBar: `${c.var.t("stock-discard.sheet.title")} ${c.var.t("common.entity")}`,
      filters,
      columns,
      data,
    }

    const locationLabel = getExportLocationFileName(c, queryParams, filters)
    const template = new WarehouseTemplate()
    await template.initWorkbook()

    template.initSheet(option.sheetName)
    template.setTitleBar(option.sheetName, option.columns, option.titleBar)
    template.setFilters(option.sheetName, option.filters)
    template.setColumns(option.columns, undefined, option.sheetName)
    template.addRows(option.sheetName, option.data)

    template.setTitle(
      `${option.titleBar} ${locationLabel} ${queryParams.from} - ${queryParams.to}`
    )
    return await template.generate()
  }

  /**
   * Generate location export to Excel
   */
  async generateLocationExport(
    c: Context,
    queryParams: StockDiscardQueryParams,
    locationData: AddRemoveDiscardPaginatedResponseDTO
  ) {
    // Determine if data comes from entity module
    const isEntitySource =
      queryParams.entity_ids ||
      queryParams.entity_tag_ids ||
      (queryParams.province_ids && queryParams.regency_ids) ||
      queryParams.entity_id ||
      queryParams.entity_tag_id ||
      (queryParams.province_id && queryParams.regency_id)

    // Generate dynamic columns based on periods and series
    const { categories, dataset, type } = locationData.data
    const columns: Column[] = [
      { key: "no", header: "No.", width: 10 },
      ...(isEntitySource
        ? [
            {
              key: "province_name",
              header: c.var.t("common.province"),
              width: 20,
            },
            {
              key: "regency_name",
              header: c.var.t("common.regency"),
              width: 20,
            },
            {
              key: "entity_id",
              header: c.var.t("common.entity_id"),
              width: 15,
            },
          ]
        : []),
      { key: "location_name", header: c.var.t("common.location"), width: 30 },
    ]

    // Add period columns with series subcolumns
    categories.forEach((category) => {
      type.forEach((seriesType) => {
        columns.push({
          key: `${category.id}_${seriesType.key}`,
          header: `${category.label} - ${seriesType.label}`,
          width: 15,
        })
      })
    })

    // Transform data for Excel
    const data = dataset.map((item, index) => {
      const row: Record<string, number | string> = {
        no: index + 1,
        ...(isEntitySource && item.province_name
          ? {
              province_name: item.province_name,
              regency_name: item.regency_name,
              entity_id: item.id,
            }
          : {}),
        location_name: item.name,
      }

      // Add period data
      categories.forEach((category, categoryIndex) => {
        type.forEach((seriesType) => {
          const periodData = item.period[categoryIndex]
          const value = periodData ? periodData[seriesType.key] || 0 : 0
          row[`${category.id}_${seriesType.key}`] = value
        })
      })

      return row
    })

    const filters = await this.generateFilters(c, queryParams)

    const option: ExcelExportOption = {
      sheetName: c.var.t("common.location"),
      titleBar: `${c.var.t("stock-discard.sheet.title")} ${c.var.t("common.location")}`,
      filters,
      columns,
      data,
    }

    const locationLabel = getExportLocationFileName(c, queryParams, filters)
    const template = new WarehouseTemplate()
    await template.initWorkbook()

    template.initSheet(option.sheetName)
    template.setTitleBar(option.sheetName, option.columns, option.titleBar)
    template.setFilters(option.sheetName, option.filters)
    template.setColumns(option.columns, undefined, option.sheetName)
    template.addRows(option.sheetName, option.data)

    template.setTitle(
      `${option.titleBar} ${locationLabel} ${queryParams.from} - ${queryParams.to}`
    )
    return await template.generate()
  }

  /**
   * Generate filters for Excel export
   */
  async generateFilters(
    c: Context,
    queryParams: StockDiscardQueryParams
  ): Promise<Filter[]> {
    const filters: Filter[] = [
      {
        key: c.var.t("common.from_date"),
        value: queryParams.from || "",
      },
      {
        key: c.var.t("common.to_date"),
        value: queryParams.to || "",
      },
      {
        key: c.var.t("common.period"),
        value: c.var.t(`common.period.${queryParams.period}`),
      },
    ]

    // Geographic filters
    if (queryParams.province_id) {
      filters.push({
        key: c.var.t("common.province"),
        value: queryParams.province_id.toString(),
      })
    }

    if (queryParams.regency_id) {
      filters.push({
        key: c.var.t("common.regency"),
        value: queryParams.regency_id.toString(),
      })
    }

    // Transaction type is always "discard" for this module
    filters.push({
      key: c.var.t("common.transaction_type"),
      value: c.var.t("transaction.type.discard"),
    })

    return filters
  }
}
