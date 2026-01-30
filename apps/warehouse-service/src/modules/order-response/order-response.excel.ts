import { Context } from "hono"
import moment from "moment"
import {
  OrderResponseQueryParams,
  OrderResponseReviewResponse,
  OrderResponsePaginatedResponse,
} from "./order-response.schema.js"
import WarehouseTemplate from "@smile-health/lib/excel/warehouse-template.js"
import { Column, Filter } from "@smile-health/lib/excel/types.js"
import { ExcelExportOption } from "@/common/types/excel.js"
import { getExportLocationFileName } from "@/common/utils/export.js"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { ActivityRepository } from "../activity/activity.repository.js"
import { RegionRepository } from "../region/region.repository.js"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { MaterialRepository } from "../material/material.repository.js"

export class OrderResponseExcel {
  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly regionRepository: RegionRepository,
    private readonly entityTagRepository: EntityTagRepository,
    private readonly entityRepository: EntityRepository,
    private readonly materialRepository: MaterialRepository
  ) {}

  /**
   * Generate review export to Excel
   */
  async generateReviewExport(
    c: Context,
    queryParams: OrderResponseQueryParams,
    reviewData: OrderResponseReviewResponse
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
      titleBar: `${c.var.t("order-response.sheet.title")} ${c.var.t("common.overview")}`,
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
      `${option.titleBar} ${locationLabel} ${moment().format("YYYY MM DD HH:mm:ss")}`
    )
    return await template.generate()
  }

  /**
   * Generate material export to Excel
   */
  async generateMaterialExport(
    c: Context,
    queryParams: OrderResponseQueryParams,
    materialData: OrderResponsePaginatedResponse
  ) {
    // Transform data to tabular format for Excel with hierarchical structure
    const { categories, dataset } = materialData.data
    const data: Record<string, number | string>[] = []

    dataset.forEach((material, materialIndex) => {
      const row: Record<string, number | string> = {
        no: materialIndex + 1,
        material_name: material.name,
      }

      // Add period data with nested structure
      categories.forEach((category, categoryIndex) => {
        materialData.data.type.forEach((type) => {
          const columnKey = `${category.label}_${type.label}`
          row[columnKey] = material.period[categoryIndex]?.[type.key] || 0
        })
      })

      data.push(row)
    })

    // Generate hierarchical columns with nested structure
    const columns: Column[] = [
      { key: "no", header: "No.", width: 10 },
      { key: "material_name", header: c.var.t("common.material"), width: 30 },
    ]

    // Add period columns with nested series as children
    categories.forEach((category) => {
      const periodColumn: Column = {
        header: category.label,
        width: materialData.data.type.length * 15,
        children: materialData.data.type.map((type) => ({
          key: `${category.label}_${type.label}`,
          header: type.label,
          width: 15,
        })),
      }
      columns.push(periodColumn)
    })

    const filters = await this.generateFilters(c, queryParams)

    const option: ExcelExportOption = {
      sheetName: c.var.t("common.material"),
      titleBar: `${c.var.t("order-response.sheet.title")} ${c.var.t("common.material")}`,
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
      `${option.titleBar} ${locationLabel} ${moment().format("YYYY MM DD HH:mm:ss")}`
    )
    return await template.generate()
  }

  /**
   * Generate entity export to Excel
   */
  async generateEntityExport(
    c: Context,
    queryParams: OrderResponseQueryParams,
    entityData: OrderResponsePaginatedResponse
  ) {
    // Transform data to tabular format for Excel with hierarchical structure
    const { categories, dataset } = entityData.data
    const data: Record<string, number | string>[] = []

    dataset.forEach((entity, entityIndex) => {
      const row: Record<string, number | string> = {
        no: entityIndex + 1,
        province_name: entity.province_name || "",
        regency_name: entity.regency_name || "",
        entity_id: entity.id,
        entity_name: entity.name,
      }

      // Add period data with nested structure
      categories.forEach((category, categoryIndex) => {
        entityData.data.type.forEach((type) => {
          const columnKey = `${category.label}_${type.label}`
          row[columnKey] = entity.period[categoryIndex]?.[type.key] || 0
        })
      })

      data.push(row)
    })

    // Generate hierarchical columns with nested structure
    const columns: Column[] = [
      { key: "no", header: "No.", width: 10 },
      { key: "province_name", header: c.var.t("common.province"), width: 20 },
      { key: "regency_name", header: c.var.t("common.regency"), width: 20 },
      { key: "entity_id", header: c.var.t("common.entity_id"), width: 15 },
      { key: "entity_name", header: c.var.t("common.entity"), width: 30 },
    ]

    // Add period columns with nested series as children
    categories.forEach((category) => {
      const periodColumn: Column = {
        header: category.label,
        width: entityData.data.type.length * 15,
        children: entityData.data.type.map((type) => ({
          key: `${category.label}_${type.label}`,
          header: type.label,
          width: 15,
        })),
      }
      columns.push(periodColumn)
    })

    const filters = await this.generateFilters(c, queryParams)

    const option: ExcelExportOption = {
      sheetName: c.var.t("common.entity"),
      titleBar: `${c.var.t("order-response.sheet.title")} ${c.var.t("common.entity")}`,
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
      `${option.titleBar} ${locationLabel} ${moment().format("YYYY MM DD HH:mm:ss")}`
    )
    return await template.generate()
  }

  /**
   * Generate location export to Excel
   */
  async generateLocationExport(
    c: Context,
    queryParams: OrderResponseQueryParams,
    locationData: OrderResponsePaginatedResponse
  ) {
    // Determine if data comes from entity module
    const isEntitySource =
      queryParams.entity_ids ||
      queryParams.entity_tag_ids ||
      (queryParams.province_ids && queryParams.regency_ids) ||
      queryParams.entity_id ||
      queryParams.entity_tag_id ||
      (queryParams.province_id && queryParams.regency_id)

    // Transform data to tabular format for Excel with hierarchical structure
    const { categories, dataset } = locationData.data
    const data: Record<string, number | string>[] = []

    dataset.forEach((location, locationIndex) => {
      const row: Record<string, number | string> = {
        no: locationIndex + 1,
        ...(isEntitySource && location.province_name
          ? {
              province_name: location.province_name || "",
              regency_name: location.regency_name || "",
              entity_id: location.id,
            }
          : {}),
        location_name: location.name,
      }

      // Add period data with nested structure
      categories.forEach((category, categoryIndex) => {
        locationData.data.type.forEach((type) => {
          const columnKey = `${category.label}_${type.label}`
          row[columnKey] = location.period[categoryIndex]?.[type.key] || 0
        })
      })

      data.push(row)
    })

    // Generate hierarchical columns with nested structure
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

    // Add period columns with nested series as children
    categories.forEach((category) => {
      const periodColumn: Column = {
        header: category.label,
        width: locationData.data.type.length * 15,
        children: locationData.data.type.map((type) => ({
          key: `${category.label}_${type.label}`,
          header: type.label,
          width: 15,
        })),
      }
      columns.push(periodColumn)
    })

    const filters = await this.generateFilters(c, queryParams)

    const option: ExcelExportOption = {
      sheetName: c.var.t("common.location"),
      titleBar: `${c.var.t("order-response.sheet.title")} ${c.var.t("common.location")}`,
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
      `${option.titleBar} ${locationLabel} ${moment().format("YYYY MM DD HH:mm:ss")}`
    )
    return await template.generate()
  }

  /**
   * Generate filters for Excel export
   */
  async generateFilters(c: Context, queryParams: OrderResponseQueryParams) {
    const {
      period,
      activity_ids,
      province_id,
      regency_id,
      entity_id,
      entity_tag_ids,
      material_ids,
    } = queryParams

    const startDate = moment(queryParams.from).format("DD MMMM YYYY")
    const endDate = moment(queryParams.to).format("DD MMMM YYYY")

    const filterPaginationOption: PaginationOption = {
      is_paginate: false,
    }
    const activities = activity_ids
      ? (
          await this.activityRepository.fetchActivities(
            c,
            queryParams,
            filterPaginationOption
          )
        ).records
      : []
    const entities = entity_id
      ? (
          await this.entityRepository.fetchEntities(
            c,
            queryParams,
            filterPaginationOption
          )
        ).records
      : []
    const entityTags = entity_tag_ids
      ? (
          await this.entityTagRepository.fetchEntityTags(
            c,
            queryParams,
            filterPaginationOption
          )
        ).records
      : []
    const provinces = province_id
      ? (
          await this.regionRepository.fetchProvinces(
            c,
            queryParams,
            filterPaginationOption
          )
        ).records
      : []
    const regencies = regency_id
      ? (
          await this.regionRepository.fetchRegencies(
            c,
            queryParams,
            filterPaginationOption
          )
        ).records
      : []
    const materials = material_ids
      ? (
          await this.materialRepository.fetchMaterials(
            c,
            { ...queryParams, material_is_stock_opname_mandatory: 0 },
            filterPaginationOption
          )
        ).records
      : []

    const filters: Filter[] = [
      {
        key: c.var.t("common.from_date"),
        value: startDate,
      },
      {
        key: c.var.t("common.to_date"),
        value: endDate,
      },
      {
        key: c.var.t("common.period"),
        value: c.var.t(`common.period.${period}`),
      },
      {
        key: c.var.t("common.activity"),
        value:
          Array.isArray(activities) && activities.length > 0
            ? activities.map((activity) => activity.name).join(", ")
            : c.var.t("common.all"),
      },
      {
        key: c.var.t("common.province"),
        value:
          Array.isArray(provinces) && provinces.length > 0
            ? provinces.map((province) => province.name).join(", ")
            : c.var.t("common.all"),
      },
      {
        key: c.var.t("common.regency"),
        value:
          Array.isArray(regencies) && regencies.length > 0
            ? regencies.map((regency) => regency.name).join(", ")
            : c.var.t("common.all"),
      },
      {
        key: c.var.t("common.entity"),
        value:
          Array.isArray(entities) && entities.length > 0
            ? entities.map((entity) => entity.name).join(", ")
            : c.var.t("common.all"),
      },
      {
        key: c.var.t("common.entity_tag"),
        value:
          Array.isArray(entityTags) && entityTags.length > 0
            ? entityTags
                .map((tag) => c.var.t(`entity_tag.label.${tag.title}`))
                .join(", ")
            : c.var.t("common.all"),
      },
      {
        key: c.var.t("common.material"),
        value:
          Array.isArray(materials) && materials.length > 0
            ? materials.map((tag) => tag.name).join(", ")
            : c.var.t("common.all"),
      },
    ]

    return filters
  }
}
