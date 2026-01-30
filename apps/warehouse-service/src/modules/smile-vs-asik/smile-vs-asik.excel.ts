import { Context } from "hono"
import moment from "moment"
import {
  SmileVsAsikQueryParams,
  TableResponse,
} from "./smile-vs-asik.schema.js"
import WarehouseTemplate from "@smile-health/lib/excel/warehouse-template.js"
import { Column, Filter } from "@smile-health/lib/excel/types.js"
import { ExcelExportOption } from "@/common/types/excel.js"
import { getExportLocationFileName } from "@/common/utils/export.js"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { ActivityRepository } from "../activity/activity.repository.js"
import { RegionRepository } from "../region/region.repository.js"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { MaterialRepository } from "../material/material.repository.js"

export class SmileVsAsikExcel {
  constructor(
    private readonly activityRepository: ActivityRepository,
    private readonly regionRepository: RegionRepository,
    private readonly entityTagRepository: EntityTagRepository,
    private readonly materialRepository: MaterialRepository
  ) {}

  async generateTableExport(
    c: Context,
    queryParams: SmileVsAsikQueryParams,
    tableData: TableResponse
  ) {
    const data = tableData.data.map((item, index) => ({
      no: index + 1,
      region_entity: item.label,
      smile_consumed: item.total_consumed,
      asik_coverage: item.total_pcare,
      percentage: item.percentage,
      dose_per_vial: item.vial,
      usage_index: item.usage_index,
      target: item.target_qty,
      scope: item.scope,
    }))

    const columns: Column[] = [
      { key: "no", header: "No.", width: 10 },
      {
        key: "region_entity",
        header: c.var.t("common.region") + "/" + c.var.t("common.entity"),
        width: 30,
      },
      {
        key: "smile_consumed",
        header: "Konsumsi SMILE",
        width: 20,
      },
      {
        key: "asik_coverage",
        header: "Cakupan ASIK",
        width: 20,
      },
      {
        key: "percentage",
        header: "Persentase",
        width: 15,
      },
      {
        key: "dose_per_vial",
        header: "Jumlah Dosis per Vial",
        width: 20,
      },
      {
        key: "usage_index",
        header: "Indeks Pemakaian",
        width: 20,
      },
      {
        key: "target",
        header: "Sasaran",
        width: 15,
      },
      {
        key: "scope",
        header: "Cakupan",
        width: 15,
      },
    ]

    const filters = await this.generateFilters(c, queryParams)

    const option: ExcelExportOption = {
      sheetName: "SMILE vs ASIK",
      titleBar: "SMILE vs ASIK",
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

  async generateFilters(c: Context, queryParams: SmileVsAsikQueryParams) {
    const {
      activity_ids,
      province_id,
      regency_id,
      entity_tag_ids,
      material_id,
      region,
      target_year,
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

    const materials = material_id
      ? (
          await this.materialRepository.fetchMaterials(
            c,
            { ...queryParams, material_ids: [material_id] },
            filterPaginationOption
          )
        ).records
      : []

    const filters: Filter[] = [
      {
        key: "Periode SMILE (Dari)",
        value: startDate,
      },
      {
        key: "Periode SMILE (Sampai)",
        value: endDate,
      },
      {
        key: "Periode ASIK",
        value: `${startDate} - ${endDate}`,
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
            ? materials.map((material) => material.name).join(", ")
            : c.var.t("common.all"),
      },
      {
        key: "Region",
        value: region === 1 ? "Vendor" : region === 2 ? "Customer" : "All",
      },
      {
        key: "Tahun Target",
        value: target_year || "-",
      },
      {
        key: "Waktu Export",
        value: moment().format("DD MMMM YYYY HH:mm:ss"),
      },
    ]

    return filters
  }
}
