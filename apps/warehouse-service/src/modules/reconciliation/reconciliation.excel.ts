import { Context } from "hono"
import moment from "moment"
import {
  ReconciliationQueryParams,
  ReconciliationEntityReportResponse,
} from "./reconciliation.schema.js"
import WarehouseTemplate from "@smile-health/lib/excel/warehouse-template.js"
import { Column, Filter } from "@smile-health/lib/excel/types.js"
import { ExcelExportOption } from "@/common/types/excel.js"
import { getExportLocationFileName } from "@/common/utils/export.js"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { ActivityRepository } from "../activity/activity.repository.js"
import { RegionRepository } from "../region/region.repository.js"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"

export class ReconciliationExcel {
  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly regionRepository: RegionRepository,
    private readonly entityTagRepository: EntityTagRepository,
    private readonly entityRepository: EntityRepository
  ) {}

  /**
   * Generate entity table report export to Excel
   */
  async generateEntityTableReportExport(
    c: Context,
    queryParams: ReconciliationQueryParams,
    entityTableReport: ReconciliationEntityReportResponse
  ) {
    const monthColumn: Column[] = Array.from({ length: 12 }, (_, i) => {
      const year = moment(queryParams.start_date).format("YYYY")
      const monthKey = moment(`${year}-${i + 1}`).format("YYYY-MM")
      const monthValue = moment().month(i).format("MMMM")
      return { key: monthKey, header: monthValue, width: 20 }
    })

    const columns: Column[] = [
      { key: "no", header: "No.", width: 20 },
      {
        key: "entity",
        header: c.var.t("common.entity"),
        width: 20,
      },
      ...monthColumn,
      {
        key: "total",
        header: c.var.t("reconciliation.label.total_frequency"),
        width: 20,
      },
      {
        key: "average",
        header: c.var.t("reconciliation.label.average_frequency"),
        width: 20,
      },
    ]

    const filters = await this.generateFilters(c, queryParams)

    const data = entityTableReport.data.map((item, index) => {
      return {
        no: index + 1,
        entity: item.name,
        ...item.months,
        total: item.total,
        average: item.average,
      }
    })

    const option: ExcelExportOption = {
      sheetName: c.var.t("reconciliation.sheet.title"),
      titleBar: `${c.var.t("common.data_table")} ${c.var.t("reconciliation.sheet.title")}`,
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
      `${option.sheetName} ${locationLabel} ${moment().format("YYYY MM DD HH:mm:ss")}`
    )
    return await template.generate()
  }

  /**
   * Generate filters for Excel export
   */
  async generateFilters(c: Context, queryParams: ReconciliationQueryParams) {
    const { activity_id, province_id, regency_id, entity_id, entity_tag_id } =
      queryParams

    const startDate = moment(queryParams.start_date).format("DD MMMM YYYY")
    const endDate = moment(queryParams.end_date).format("DD MMMM YYYY")

    const filterPaginationOption: PaginationOption = {
      is_paginate: false,
    }
    const activities = activity_id
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
            {
              ...queryParams,
              from: queryParams.start_date,
              to: queryParams.end_date,
            },
            filterPaginationOption
          )
        ).records
      : []
    const entityTags = entity_tag_id
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
    ]

    return filters
  }
}
