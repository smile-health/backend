import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { BaseWorker } from "../base.worker.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { PeriodicMaterialStockRepository } from "./periodic-material-stock.repository.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { MultiSheetZipExporter } from "@smile-health/lib/excel/multi-sheet-zip.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { PeriodicMaterialStockQueryParams } from "./periodic-material-stock.schema.js"
import env from "../../config/env.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { Context } from "hono"
import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { applyQtyData } from "./periodic-material-stock.utils.js"
import { round } from "@smile-health/lib/utils.js"
import moment from "moment"
import { Column, Filter } from "@smile-health/lib/excel/types.js"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { ActivityRepository } from "../activity/activity.repository.js"

export class PeriodicMaterialStockWorker extends BaseWorker {
  constructor(
    private readonly periodicMaterialStockRepository: PeriodicMaterialStockRepository,
    private readonly materialRepository: MaterialRepository,
    private readonly entityRepository: EntityRepository,
    private readonly activityRepository: ActivityRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository
  ) {
    super(exportHistoryRepo)
  }

  public registerWorkers(consumer: Consumer<DB>) {
    consumer.route(
      TOPIC.PERIODIC_MATERIAL_STOCK_ALL_EXPORTED,
      async (c, msg) => {
        const parseMsg = JSON.parse(msg ?? "{}")
        const { params, options, language, timezone } = parseMsg.payload

        await this.processAsyncExport(c, options, async () => {
          return await this.prepareExporter(c, language, timezone, params)
        })
      }
    )
  }

  private async prepareExporter(
    c: CustomContext<DB>,
    language: string,
    timezone: string,
    queryParams: PeriodicMaterialStockQueryParams
  ) {
    const { province_id, regency_id } = queryParams
    const childQueryParams = { ...queryParams }

    delete childQueryParams.entity_type_id
    if (!province_id && !regency_id) {
      childQueryParams.entity_type_ids = [
        ENTITY_TYPE.PROVINCE,
        ENTITY_TYPE.REGENCY,
      ]
    } else if (province_id && !regency_id) {
      childQueryParams.entity_type_ids = [ENTITY_TYPE.REGENCY]
    } else {
      childQueryParams.entity_type_ids = [
        ENTITY_TYPE.HEALTHCARE_FACILITY,
        ENTITY_TYPE.DISTRICT_HEALTH_CENTER,
      ]
    }

    const entityResult = await this.entityRepository.fetchEntities(
      c as Context,
      childQueryParams,
      { is_paginate: false }
    )
    const entities = entityResult.records

    const exporter = new MultiSheetZipExporter({
      language,
      timezone,
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })

    for await (const entity of entities) {
      queryParams.entity_id = entity.id

      const { records: materials } =
        await this.materialRepository.fetchMaterials(
          c as Context,
          queryParams,
          { is_paginate: false }
        )

      const countData =
        await this.periodicMaterialStockRepository.fetchMaterialCount(
          c as Context,
          queryParams
        )

      const materialList = applyQtyData(queryParams, materials, countData)

      const data = materialList.map((item, index) => ({
        no: index + 1,
        material_name: item.name,
        opening_qty: round(item.opening_qty),
        received_qty: round(item.received_qty),
        ordered_qty: round(item.ordered_qty),
        issues_qty: round(item.issues_qty),
        discard_qty: round(item.discard_qty),
        closing_qty: round(item.closing_qty),
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

      const filters = await this.generateFilters(
        c as Context,
        queryParams,
        entity.province_name || "",
        entity.regency_name || "",
        entity.name
      )

      const periodLabel =
        queryParams.period === "monthly"
          ? c.var.t("common.monthly")
          : c.var.t("common.annual")

      const titleBar = `${c.var.t("periodic-material-stock.sheet.title")} ${periodLabel}`

      const groupId = entity.id.toString()
      await exporter.initFileGroupWarehouse(groupId, entity.name)

      const sheetName = c.var.t("periodic-material-stock.sheet.title")
      await exporter.initSheet(groupId, sheetName)
      await exporter.setTitleBar(groupId, sheetName, columns, titleBar)
      await exporter.setFilters(groupId, sheetName, filters)
      await exporter.setColumns(groupId, sheetName, columns)
      await exporter.addRows(
        groupId,
        sheetName,
        data as Record<string, unknown>[]
      )
    }

    return exporter
  }

  private async generateFilters(
    c: Context,
    queryParams: PeriodicMaterialStockQueryParams,
    provinceName: string,
    regencyName: string,
    entityName: string
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
        value: provinceName,
      },
      {
        key: c.var.t("common.regency"),
        value: regencyName,
      },
      {
        key: c.var.t("common.entity"),
        value:
          Array.isArray(entities) && entities.length > 0
            ? entities.map((entity) => entity.name).join(", ")
            : entityName,
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
