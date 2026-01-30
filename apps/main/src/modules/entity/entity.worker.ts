import { DB } from "@/common/infrastructure/database/types/db.js"
import { MultiSheetZipExporter } from "@smile-health/lib/excel/multi-sheet-zip.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { Context } from "hono"
import moment from "moment"
import env from "../../config/env.js"
import { BaseWorker } from "../base.worker.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { EntityRepository } from "./entity.repository.js"
import { GetEntitiesQueries } from "./entity.schema.js"

export class EntityWorker extends BaseWorker {
  constructor(
    private readonly repository: EntityRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository
  ) {
    super(exportHistoryRepo)
  }

  public registerWorkers(consumer: Consumer<DB>) {
    consumer.route(TOPIC.ENTITY_PROGRAM_EXPORTED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      const { params, options, language, timezone } = parseMsg.payload

      await this.processAsyncExport(c, options, async () => {
        return await this.prepareExporter(c, language, timezone, params)
      })
    })
  }
  private async prepareExporter(
    c: CustomContext<DB>,
    language: string,
    timezone: string,
    params: GetEntitiesQueries
  ) {
    const exporter = new MultiSheetZipExporter({
      language,
      timezone,
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })

    const entityGroup = {
      id: c.var.t("common.entity"),
      name: c.var.t("common.entity"),
      sheets: {
        entity: {
          sheetName: c.var.t("common.entity"),
        },
      },
      columns: {
        entity: [
          { header: c.var.t("entity.label.id_province"), width: 15 },
          { header: c.var.t("entity.label.province"), width: 30 },
          { header: c.var.t("entity.label.id_regency"), width: 20 },
          { header: c.var.t("entity.label.regency"), width: 35 },
          { header: c.var.t("entity.label.id_sub_district"), width: 20 },
          { header: c.var.t("entity.label.sub_district"), width: 30 },
          { header: c.var.t("entity.label.id_village"), width: 20 },
          { header: c.var.t("entity.label.village"), width: 30 },
          { header: c.var.t("entity.label.id_entity"), width: 15 },
          { header: c.var.t("entity.label.name"), width: 60 },
          { header: c.var.t("entity.label.code"), width: 20 },
          { header: c.var.t("entity.label.msi_code"), width: 20 },
          { header: c.var.t("entity.label.type"), width: 15 },
          { header: c.var.t("entity.label.entity_tag"), width: 35 },
          { header: c.var.t("entity.label.address"), width: 70 },
          { header: c.var.t("entity.label.status"), width: 10 },
          { header: c.var.t("entity.label.is_vendor"), width: 15 },
          { header: c.var.t("entity.label.is_relocation"), width: 15 },
          { header: c.var.t("entity.label.update_at"), width: 15 },
          { header: c.var.t("entity.label.created_by"), width: 20 },
        ],
      },
    }

    exporter.initFileGroup(entityGroup.id, entityGroup.name)
    await exporter.initSheet(
      entityGroup.id,
      entityGroup.sheets.entity.sheetName
    )
    exporter.setColumns(
      entityGroup.id,
      entityGroup.sheets.entity.sheetName,
      entityGroup.columns.entity
    )

    const stream = await this.repository.getEntitiesStreamData(
      c as Context,
      params
    )
    const defaultValue = (value: string | number | null) => value != null ? String(value) : "-"
    const getTranslation = (key: string, column: string | null) => {
      if (!column) return null
      const result = c.var.t(`${key}.${column}`)
      return result.includes(".label.") ? key : result
    }

    for await (const item of stream) {
      const statusActive = this.#generateStatusLabel(c, item)
      const statusVendor = this.#generateStatusVendorLabel(c, item)
      const statusRelocation = this.#generateStatusRelocationLabel(c, item)

      const row = {
        province_id: defaultValue(item.province_id),
        province_name: defaultValue(item.province_name),
        regency_id: defaultValue(item.regency_id),
        regency_name: defaultValue(item.regency_name),
        sub_district_id: defaultValue(item.sub_district_id),
        sub_district_name: defaultValue(item.sub_district_name),
        village_id: defaultValue(item.village_id),
        village_name: defaultValue(item.village_name),
        entity_id: defaultValue(`${item.id}`),
        name: defaultValue(item.name),
        code: defaultValue(item.code),
        id_satu_sehat: defaultValue(item.id_satu_sehat),
        entity_type_name: defaultValue(
          getTranslation("entity_type.label", item.entity_type_name)
        ),
        entity_tag_name: defaultValue(
          getTranslation("entity_tag.label", item.entity_tag_name)
        ),
        address: defaultValue(item.address),
        statusActive,
        statusVendor,
        statusRelocation,
        updated_at: item.updated_at
          ? moment(item.updated_at).locale(language).format("DD MMM YYYY")
          : "-",
        full_user_name: defaultValue(item.full_user_name),
      }

      await exporter.addRow(
        entityGroup.id,
        entityGroup.sheets.entity.sheetName,
        row
      )
    }

    return exporter
  }

  #generateStatusLabel(c, item): string {
    let status = c.var.t("common.inactive")
    if (item.status === 1) {
      status = c.var.t("common.active")
    }

    return status
  }

  #generateStatusVendorLabel(c, item): string {
    let status = c.var.t("common.no")
    if (item.is_vendor === 1) {
      status = c.var.t("common.yes")
    }

    return status
  }

  #generateStatusRelocationLabel(c, item): string {
    let status = c.var.t("common.no")
    if (item.is_relocation === 1) {
      status = c.var.t("common.yes")
    }

    return status
  }
}
