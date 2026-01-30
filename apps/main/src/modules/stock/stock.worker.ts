import { DB } from "@/common/infrastructure/database/types/db.js"
import { MultiSheetZipExporter } from "@smile-health/lib/excel/multi-sheet-zip.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { Context } from "hono"
import env from "../../config/env.js"
import { BaseWorker } from "../base.worker.js"
import { EntityMaterialRepository } from "../entity-material/entity-material.repository.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { StockRepository } from "./stock.repository.js"
import { GetStocksQueries, StockGroupExporter } from "./stock.schema.js"

export class StockWorker extends BaseWorker {
  constructor(
    private readonly stockRepo: StockRepository,
    private readonly entityMaterialRepo: EntityMaterialRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository
  ) {
    super(exportHistoryRepo)
  }

  public registerWorkers(consumer: Consumer<DB>) {
    consumer.route(TOPIC.VIEW_STOCK_EXPORTED, async (c, msg) => {
      const parseMsg = JSON.parse(msg ?? "{}")
      const { params, options, language, timezone, config } = parseMsg.payload

      await this.processAsyncExport(c, options, async () => {
        return await this.prepareExporter(c, language, timezone, params, config)
      })
    })
  }

  private async prepareExporter(
    c: CustomContext<DB>,
    language: string,
    timezone: string,
    params: GetStocksQueries,
    config: { material: { is_hierarchy_enabled?: boolean } }
  ) {
    const isHierarchy = config.material.is_hierarchy_enabled ?? false

    const exporter = new MultiSheetZipExporter({
      language,
      timezone,
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })

    const stockGroup: StockGroupExporter = {
      id: c.var.t("common.stock"),
      name: c.var.t("common.stock"),
      sheets: {
        materialVariants: {
          sheetName: c.var.t("material_level.label.variant"),
        },
      },
      columns: {
        materialVariants: [
          { header: c.var.t("stock.sheet.entity_id"), width: 10 },
          { header: c.var.t("stock.sheet.entity_name"), width: 40 },
          { header: c.var.t("stock.sheet.province"), width: 30 },
          { header: c.var.t("stock.sheet.regency"), width: 30 },
          { header: c.var.t("stock.sheet.sub_district"), width: 30 },
          { header: c.var.t("stock.sheet.entity_type"), width: 10 },
          { header: c.var.t("stock.sheet.material_name_template"), width: 60 },
          { header: c.var.t("stock.sheet.material_name_variant"), width: 80 },
          { header: c.var.t("stock.sheet.material_hierarchy_code"), width: 30 },
          { header: c.var.t("stock.sheet.material_code"), width: 30 },
          { header: c.var.t("stock.sheet.batch_code"), width: 15 },
          { header: c.var.t("stock.sheet.expired_date"), width: 20 },
          { header: c.var.t("stock.sheet.activity"), width: 15 },
          { header: c.var.t("stock.sheet.qty"), width: 10 },
          { header: c.var.t("stock.sheet.min"), width: 5 },
          { header: c.var.t("stock.sheet.max"), width: 5 },
          { header: c.var.t("stock.sheet.price"), width: 10 },
          { header: c.var.t("stock.sheet.total_price"), width: 10 },
          { header: c.var.t("stock.sheet.budget_source"), width: 15 },
          { header: c.var.t("stock.sheet.budget_year"), width: 15 },
        ],
      },
    }

    if (isHierarchy) {
      stockGroup.sheets.materialTemplate = {
        sheetName: c.var.t("material_level.label.template"),
      }
      stockGroup.columns.materialTemplate = [
        { header: c.var.t("stock.sheet.entity_id"), width: 10 },
        { header: c.var.t("stock.sheet.entity_name"), width: 40 },
        { header: c.var.t("stock.sheet.province"), width: 30 },
        { header: c.var.t("stock.sheet.regency"), width: 30 },
        { header: c.var.t("stock.sheet.sub_district"), width: 30 },
        { header: c.var.t("stock.sheet.entity_type"), width: 10 },
        { header: c.var.t("stock.sheet.material_name"), width: 80 },
        { header: c.var.t("stock.sheet.material_hierarchy_code"), width: 30 },
        { header: c.var.t("stock.sheet.material_code"), width: 30 },
        { header: c.var.t("stock.sheet.on_hand_qty"), width: 10 },
        { header: c.var.t("stock.sheet.allocated_qty"), width: 10 },
        { header: c.var.t("stock.sheet.available_qty"), width: 10 },
        { header: c.var.t("stock.sheet.min"), width: 5 },
        { header: c.var.t("stock.sheet.max"), width: 5 },
      ]
      // Sheet 1
      await this.#configExcel(exporter, stockGroup, "materialTemplate", true)
    }

    // Sheet 2, if hierarchy
    await this.#configExcel(
      exporter,
      stockGroup,
      "materialVariants",
      !isHierarchy
    )

    if (isHierarchy) {
      const hierarchyStream = await this.stockRepo.getHierarchyStreamData(
        c as Context,
        params
      )
      const variantStream = await this.stockRepo.getStreamData(
        c as Context,
        params,
        isHierarchy
      )

      console.log("processing template")

      await Promise.all([
        exporter.addRows(
          stockGroup.id,
          stockGroup.sheets.materialTemplate!.sheetName,
          this.transformStream(hierarchyStream, (item) => ({
            ...item,
            entity_type: item.entity_type
              ? c.var.t("entity_type.label." + item.entity_type)
              : "",
          }))
        ),

        exporter.addRows(
          stockGroup.id,
          stockGroup.sheets.materialVariants!.sheetName,
          this.transformStream(variantStream, (item) => ({
            ...item,
            entity_type: item.entity_type
              ? c.var.t("entity_type.label." + item.entity_type)
              : "",
          }))
        ),
      ])
    } else {
      const variantStream = await this.stockRepo.getStreamData(
        c as Context,
        params,
        isHierarchy
      )

      await exporter.addRows(
        stockGroup.id,
        stockGroup.sheets.materialVariants!.sheetName,
        variantStream.map((item) => ({
          ...item,
          entity_type: item.entity_type
            ? c.var.t("entity_type.label." + item.entity_type)
            : "",
        }))
      )
    }

    return exporter
  }

  async #configExcel(
    exporter: MultiSheetZipExporter,
    stockGroup: StockGroupExporter,
    groupId: string,
    initGroup: boolean = false
  ) {
    if (initGroup) {
      exporter.initFileGroup(stockGroup.id, stockGroup.name)
    }

    if (!stockGroup.sheets[groupId]?.sheetName) return

    await exporter.initSheet(
      stockGroup.id,
      stockGroup.sheets[groupId].sheetName
    )
    exporter.setColumns(
      stockGroup.id,
      stockGroup.sheets[groupId].sheetName,
      stockGroup.columns[groupId] ?? []
    )
  }
}
