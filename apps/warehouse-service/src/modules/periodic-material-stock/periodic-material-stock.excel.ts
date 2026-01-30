import { Context } from "hono"
import moment from "moment"
import {
  PeriodicMaterialStockQueryParams,
  PeriodicMaterialStockResponse,
} from "./periodic-material-stock.schema.js"
import WarehouseTemplate from "@smile-health/lib/excel/warehouse-template.js"
import { Column, Filter } from "@smile-health/lib/excel/types.js"
import { ExcelExportOption } from "@/common/types/excel.js"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { ActivityRepository } from "../activity/activity.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { MaterialRepository } from "../material/material.repository.js"

export class PeriodicMaterialStockExcel {
  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly entityRepository: EntityRepository,
    private readonly materialRepository: MaterialRepository
  ) {}

  async generateReportExport(
    c: Context,
    queryParams: PeriodicMaterialStockQueryParams,
    reportData: PeriodicMaterialStockResponse
  ) {
    const data = reportData.data.map((item, index) => ({
      no: index + 1,
      material_name: item.name,
      opening_qty: item.opening_qty,
      received_qty: item.received_qty,
      ordered_qty: item.ordered_qty,
      issues_qty: item.issues_qty,
      discard_qty: item.discard_qty,
      closing_qty: item.closing_qty,
    }))

    const columns: Column[] = [
      { key: "no", header: "No.", width: 10 },
      { key: "material_name", header: c.var.t("common.material"), width: 30 },
      {
        key: "opening_qty",
        header: c.var.t("periodic-material-stock.opening_qty"),
        width: 15,
      },
      {
        key: "received_qty",
        header: c.var.t("periodic-material-stock.received_qty"),
        width: 15,
      },
      {
        key: "ordered_qty",
        header: c.var.t("periodic-material-stock.ordered_qty"),
        width: 15,
      },
      {
        key: "issues_qty",
        header: c.var.t("periodic-material-stock.issues_qty"),
        width: 15,
      },
      {
        key: "discard_qty",
        header: c.var.t("periodic-material-stock.discard_qty"),
        width: 15,
      },
      {
        key: "closing_qty",
        header: c.var.t("periodic-material-stock.closing_qty"),
        width: 15,
      },
    ]

    const filters = await this.generateFilters(c, queryParams, reportData)

    const periodLabel =
      queryParams.period === "monthly"
        ? c.var.t("common.monthly")
        : c.var.t("common.annual")

    const option: ExcelExportOption = {
      sheetName: c.var.t("periodic-material-stock.sheet.title"),
      titleBar: `${c.var.t("periodic-material-stock.sheet.title")} ${periodLabel}`,
      filters,
      columns,
      data,
    }

    const template = new WarehouseTemplate()
    await template.initWorkbook()

    template.initSheet(option.sheetName)
    template.setTitleBar(option.sheetName, option.columns, option.titleBar)
    template.setFilters(option.sheetName, option.filters)
    template.setColumns(option.columns, undefined, option.sheetName)
    template.addRows(option.sheetName, option.data)

    const fileName = `${option.titleBar} ${reportData.entity_name} ${moment().format("YYYY MM DD HH:mm:ss")}`
    template.setTitle(fileName)

    return await template.generate()
  }

  private async generateFilters(
    c: Context,
    queryParams: PeriodicMaterialStockQueryParams,
    reportData: PeriodicMaterialStockResponse
  ): Promise<Filter[]> {
    const { from, to, period, activity_ids, material_ids, entity_id } =
      queryParams

    const startDate = moment(from).format("DD MMM YYYY")
    const endDate = moment(to).format("DD MMM YYYY")

    const filterPaginationOption: PaginationOption = {
      is_paginate: false,
      count: false,
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
        value:
          period === "monthly"
            ? c.var.t("common.monthly")
            : c.var.t("common.annual"),
      },
      {
        key: c.var.t("common.province"),
        value: reportData.province_name,
      },
      {
        key: c.var.t("common.regency"),
        value: reportData.regency_name,
      },
      {
        key: c.var.t("common.entity"),
        value:
          Array.isArray(entities) && entities.length > 0
            ? entities.map((entity) => entity.name).join(", ")
            : reportData.entity_name,
      },
      {
        key: c.var.t("common.activity"),
        value:
          Array.isArray(activities) && activities.length > 0
            ? activities.map((activity) => activity.name).join(", ")
            : c.var.t("common.all"),
      },
      {
        key: c.var.t("common.material"),
        value:
          Array.isArray(materials) && materials.length > 0
            ? materials.map((material) => material.name).join(", ")
            : c.var.t("common.all"),
      },
    ]

    return filters
  }
}
