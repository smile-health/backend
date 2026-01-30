import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { ExcelExportOption } from "@/common/types/excel.js"
import { Column, Filter } from "@smile-health/lib/excel/types.js"
import { Context } from "hono"
import moment from "moment-timezone"
import { MasterDataRepository } from "../../common/repositories/master-data.repository.js"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { RegionRepository } from "../region/region.repository.js"
import {
  AssetInventoryOverviewResponse,
  AssetInventoryQueryParams,
} from "./asset-inventory.schema.js"

export class AssetInventoryExcel {
  constructor(
    private readonly regionRepository: RegionRepository,
    private readonly entityTagRepository: EntityTagRepository,
    private readonly masterDataRepository: MasterDataRepository
  ) {}

  async generateFilters(c: Context, queryParams: AssetInventoryQueryParams) {
    const {
      province_ids,
      regency_ids,
      entity_ids,
      entity_tag_ids,
      type_ids,
      manufacture_ids,
      model_ids,
      ownership_status_ids,
      statuses,
      power_available_ids,
      is_deleted,
      prod_years,
      asset_capacity_ids,
      budget_years,
      vendor_ids,
      communication_provider_ids,
      working_status_ids,
    } = queryParams
    const { t } = c.var

    const startDate = moment(queryParams.from).format("DD MMMM YYYY")
    const endDate = moment(queryParams.to).format("DD MMMM YYYY")

    const filterPaginationOption: PaginationOption = {
      is_paginate: false,
    }

    // Parallel fetch of all filter data
    const [
      provinces,
      regencies,
      entities,
      entityTags,
      assetTypes,
      manufactures,
      assetModels,
      assetElectricities,
      assetVendors,
      assetWorkingStatuses,
    ] = await Promise.all([
      province_ids
        ? (
            await this.regionRepository.fetchProvinces(
              c,
              queryParams,
              filterPaginationOption
            )
          ).records
        : [],
      regency_ids
        ? (
            await this.regionRepository.fetchRegencies(
              c,
              queryParams,
              filterPaginationOption
            )
          ).records
        : [],
      entity_ids
        ? await this.masterDataRepository.fetchDataByIds("entity", entity_ids)
        : [],
      entity_tag_ids
        ? (
            await this.entityTagRepository.fetchEntityTags(
              c,
              queryParams,
              filterPaginationOption
            )
          ).records
        : [],
      type_ids
        ? await this.masterDataRepository.fetchDataByIds("asset_type", type_ids)
        : [],
      manufacture_ids
        ? await this.masterDataRepository.fetchDataByIds(
            "manufacture",
            manufacture_ids
          )
        : [],
      model_ids
        ? await this.masterDataRepository.fetchDataByIds(
            "asset_model",
            model_ids
          )
        : [],
      power_available_ids
        ? await this.masterDataRepository.fetchDataByIds(
            "asset_electricity",
            power_available_ids
          )
        : [],
      vendor_ids || communication_provider_ids
        ? await this.masterDataRepository.fetchDataByIds("asset_vendor", [
            ...(vendor_ids || []),
            ...(communication_provider_ids || []),
          ])
        : [],
      working_status_ids
        ? await this.masterDataRepository.fetchDataByIds(
            "asset_working_status",
            working_status_ids
          )
        : [],
    ])

    // Build filters array
    const filters: Filter[] = [
      {
        key: t("common.province"),
        value:
          Array.isArray(provinces) && provinces.length > 0
            ? provinces.map((province) => province.name).join(", ")
            : t("common.all"),
      },
      {
        key: t("common.regency"),
        value:
          Array.isArray(regencies) && regencies.length > 0
            ? regencies.map((regency) => regency.name).join(", ")
            : t("common.all"),
      },
      {
        key: t("common.entity"),
        value:
          Array.isArray(entities) && entities.length > 0
            ? entities.map((entity) => entity.name).join(", ")
            : t("common.all"),
      },
      {
        key: t("common.export_time"),
        value: c.toLocalDate(new Date(), "DD MMMM YYYY HH:mm:ss"),
      },
      {
        key: t("common.period"),
        value: `${startDate} - ${endDate}`,
      },
      {
        key: t("common.entity_tag"),
        value:
          Array.isArray(entityTags) && entityTags.length > 0
            ? entityTags
                .map((tag) => t(`entity_tag.label.${tag.title}`))
                .join(", ")
            : t("common.all"),
      },
      {
        key: t("asset_inventory.label.asset_type_name"),
        value:
          Array.isArray(assetTypes) && assetTypes.length > 0
            ? assetTypes.map((type) => type.name).join(", ")
            : t("common.all"),
      },
      {
        key: t("asset_inventory.label.manufacture_name"),
        value:
          Array.isArray(manufactures) && manufactures.length > 0
            ? manufactures.map((manufacture) => manufacture.name).join(", ")
            : t("common.all"),
      },
      {
        key: t("asset_inventory.label.asset_model_name"),
        value:
          Array.isArray(assetModels) && assetModels.length > 0
            ? assetModels.map((model) => model.name).join(", ")
            : t("common.all"),
      },
      {
        key: t("asset_inventory.label.ownership_status"),
        value:
          ownership_status_ids && ownership_status_ids.length > 0
            ? ownership_status_ids
                .map((status) =>
                  status === 1
                    ? t("asset_inventory.label.owned")
                    : status === 2
                      ? t("asset_inventory.label.borrowed")
                      : t("common.unknown")
                )
                .join(", ")
            : t("common.all"),
      },
      {
        key: "Status",
        value:
          statuses && statuses.length > 0
            ? statuses
                .map((status) =>
                  status === 0
                    ? t("common.inactive")
                    : status === 1
                      ? t("common.active")
                      : t("common.unknown")
                )
                .join(", ")
            : t("common.all"),
      },
      {
        key: t("rtmd.export.headers.power_availability"),
        value:
          Array.isArray(assetElectricities) && assetElectricities.length > 0
            ? assetElectricities
                .map((electricity) => t(electricity.name))
                .join(", ")
            : t("common.all"),
      },
      {
        key: t("common.is_deleted"),
        value:
          is_deleted !== undefined
            ? is_deleted === 0
              ? t("common.no")
              : t("common.yes")
            : t("common.all"),
      },
      {
        key: t("asset_inventory.label.production_year"),
        value:
          prod_years && prod_years.length > 0
            ? prod_years.join(", ")
            : t("common.all"),
      },
      {
        key: t("asset_inventory.label.asset_capacity"),
        value:
          asset_capacity_ids && asset_capacity_ids.length > 0
            ? asset_capacity_ids
                .map((capacity) => {
                  switch (capacity) {
                    case 1:
                      return t("common.exist")
                    case 2:
                      return t("common.not_exist")
                    case 3:
                      return t("common.need_clarification")
                    default:
                      return "-"
                  }
                })
                .join(", ")
            : t("common.all"),
      },
      {
        key: t("asset_inventory.label.budget_year"),
        value:
          budget_years && budget_years.length > 0
            ? budget_years.join(", ")
            : t("common.all"),
      },
      {
        key: t("common.vendor"),
        value:
          Array.isArray(assetVendors) && assetVendors.length > 0
            ? assetVendors.map((vendor) => vendor.name).join(", ")
            : t("common.all"),
      },
      {
        key: t("rtmd.export.headers.communication_provider"),
        value:
          Array.isArray(assetVendors) && assetVendors.length > 0
            ? assetVendors.map((vendor) => vendor.name).join(", ")
            : t("common.all"),
      },
      {
        key: t("asset_inventory.label.working_status_name"),
        value:
          Array.isArray(assetWorkingStatuses) && assetWorkingStatuses.length > 0
            ? assetWorkingStatuses.map((status) => t(status.name)).join(", ")
            : t("common.all"),
      },
    ]

    return filters
  }

  buildTableExportColumns(c: Context): Column[] {
    return [
      { key: "no", header: "No.", width: 20 },
      { key: "entity_id", header: c.var.t("common.entity_id"), width: 10 },
      {
        key: "entity_name",
        header: c.var.t("common.entity"),
        width: 30,
      },
    ]
  }

  buildOverviewExportColumns(c: Context): Column[] {
    return [
      { key: "no", header: "No.", width: 20 },
      {
        key: "entity_tag",
        header: c.var.t("common.entity_tag"),
        width: 30,
      },
    ]
  }

  buildAssetInventoryExportOptions(
    c: Context,
    tableData: {
      data: Array<{
        id?: number
        title: string
        total: number
        details?: Array<{ id: number; title: string; total: number }>
      }>
    },
    overviewData: AssetInventoryOverviewResponse,
    filters: Filter[]
  ): ExcelExportOption[] {
    const options: ExcelExportOption[] = []

    // Sheet 1: Asset Ownership Table
    const tableColumns = this.buildTableExportColumns(c)

    // Add asset type columns dynamically based on the data
    if (tableData.data && tableData.data.length > 0) {
      const firstItem = tableData.data[0]
      if (firstItem && firstItem.details && firstItem.details.length > 0) {
        firstItem.details.forEach((detail) => {
          tableColumns.push({
            key: `asset_type_${detail.id}`,
            header: detail.title,
            width: 20,
          })
        })
      }

      tableColumns.push({ key: "total", header: "Total", width: 20 })
    }

    const tableExportData = tableData.data.map((item, index: number) => {
      const row: Record<string, number | string> = {
        no: index + 1,
        entity_id: Number(item.id),
        entity_name: item.title,
      }

      // Add asset type quantities
      item.details?.forEach((detail) => {
        row[`asset_type_${detail.id}`] = detail.total
      })

      row.total = item.total

      return row
    })

    options.push({
      sheetName: c.var.t("dashboard.asset_inventory.label.table_sheet"),
      titleBar: c.var.t("dashboard.asset_inventory.label.table_sheet"),
      filters,
      columns: tableColumns,
      data: tableExportData,
    })

    // Sheet 2: Asset Ownership Overview
    const overviewColumns = this.buildOverviewExportColumns(c)

    // Add asset type columns dynamically based on overview data
    if (overviewData.data && overviewData.data.length > 0) {
      const firstItem = overviewData.data[0]
      if (firstItem && firstItem.details && firstItem.details.length > 0) {
        firstItem.details.forEach((detail) => {
          overviewColumns.push({
            key: `asset_type_${detail.id}`,
            header: detail.title,
            width: 20,
          })
        })
      }

      overviewColumns.push({ key: "total", header: "Total", width: 20 })
    }

    const overviewExportData = overviewData.data.map((item, index: number) => {
      const row: Record<string, number | string> = {
        no: index + 1,
        entity_tag: item.title,
      }

      // Add asset type quantities
      item.details?.forEach((detail) => {
        row[`asset_type_${detail.id}`] = detail.total
      })
      row.total = item.total

      return row
    })

    options.push({
      sheetName: c.var.t("dashboard.asset_inventory.label.overview_sheet"),
      titleBar: c.var.t("dashboard.asset_inventory.label.overview_sheet"),
      filters,
      columns: overviewColumns,
      data: overviewExportData,
    })

    return options
  }
}
