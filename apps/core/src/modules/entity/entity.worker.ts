import { DB } from "@/common/infrastructure/database/types/db.js"
import { MultiSheetZipExporter } from "@smile-health/lib/excel/multi-sheet-zip.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import env from "../../config/env.js"
import { BaseWorker } from "../base.worker.js"
import { ExportHistoryRepository } from "../export-history/export-history.repository.js"
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
    consumer.route(TOPIC.ENTITY_EXPORTED, async (c, msg) => {
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
      timezone: timezone,
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })

    // init sheet, default
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
          { header: c.var.t("entity.label.id_villages"), width: 20 },
          { header: c.var.t("entity.label.village"), width: 30 },
          { header: c.var.t("entity.label.id_entity"), width: 15 },
          { header: c.var.t("entity.label.msi_code"), width: 20 },
          { header: c.var.t("entity.label.name"), width: 60 },
          { header: c.var.t("entity.label.code"), width: 20 },
          { header: c.var.t("entity.label.type"), width: 20 },
          { header: c.var.t("entity.label.entity_tag"), width: 35 },
          { header: c.var.t("entity.label.address"), width: 70 },
          { header: "Program", width: 20 },
          { header: c.var.t("entity.label.update_at"), width: 20 },
          { header: c.var.t("entity.label.created_by"), width: 20 },
        ],
      },
    }

    const stream = await this.repository.findAllSearchableAndStreamable(
      c,
      params
    )

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

    const defaultValue = (value: string | null) => value ?? "-"
    const getTranslation = (key: string, column: string | null) => {
      if (!column) return null
      const result = c.var.t(`${key}.${column}`)
      return result.includes(".label.") ? key : result
    }

    for await (const item of stream) {
      const row = {
        province_id: defaultValue(item.province_id),
        province: defaultValue(item.province_name),
        regency_id: defaultValue(item.regency_id),
        regency: defaultValue(item.regency_name),
        sub_district_id: defaultValue(item.sub_district_id),
        sub_district: defaultValue(item.sub_district_name),
        village_id: defaultValue(item.village_id),
        village: defaultValue(item.village_name),
        entity_id: defaultValue(`${item.id}`),
        msi_code: item.id_satu_sehat || '-',
        name: defaultValue(item.name),
        code: defaultValue(item.code),
        type: defaultValue(getTranslation("entity_type.label", item.type_name)),
        entity_tag: defaultValue(
          getTranslation("entity_tag.label", item.entity_tag_name)
        ),
        address: defaultValue(item.address),
        programs: item.programs,
        updated_at: item.updated_at,
        created_by: defaultValue(item.created_by_name),
      }

      await exporter.addRow(
        entityGroup.id,
        entityGroup.sheets.entity.sheetName,
        row
      )
    }

    return exporter
  }
}
