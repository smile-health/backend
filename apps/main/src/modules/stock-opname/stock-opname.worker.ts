import { DB } from "@/common/infrastructure/database/types/db.js"
import env from "@/config/env.js"
import { MultiSheetZipExporter } from "@smile/lib/excel/multi-sheet-zip.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { formatPeriodName } from "@smile/lib/utils.js"
import moment from "moment"
import { BaseWorker } from "../base.worker.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import StockOpnameRepository from "./stock-opname.repository.js"
import { GetStockOpnameParamsDTO } from "./stock-opname.schema.js"

export class StockOpnameWorker extends BaseWorker {
  constructor(
    private readonly repo: StockOpnameRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository
  ) {
    super(exportHistoryRepo)
  }

  public registerWorkers(consumer: Consumer<DB>) {
    consumer.route(TOPIC.STOCK_OPNAME_EXPORTED, async (c, msg) => {
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
    params: GetStockOpnameParamsDTO
  ) {
    // Construct columns
    const columns = [
      {
        key: "entity",
        header: c.var.t("stock_opname.label.entity_name"),
        width: 35,
      },
      {
        key: "province",
        header: c.var.t("stock_opname.label.province"),
        width: 35,
      },
      {
        key: "regency",
        header: c.var.t("stock_opname.label.regency"),
        width: 35,
      },
      {
        key: "material_name",
        header: c.var.t("stock_opname.label.material_name"),
        width: 50,
      },
      {
        key: "batch",
        header: c.var.t("stock_opname.label.batch"),
        width: 25,
      },
      {
        key: "expired_date_batch",
        header: c.var.t("stock_opname.label.expired_date_batch"),
        width: 15,
      },
      {
        key: "recorded_qty",
        header: c.var.t("stock_opname.label.recorded_qty"),
        width: 15,
      },
      {
        key: "in_transit_qty",
        header: c.var.t("stock_opname.label.in_transit_qty"),
        width: 15,
      },
      {
        key: "actual_qty",
        header: c.var.t("stock_opname.label.actual_qty"),
        width: 15,
      },
      {
        key: "created_at",
        header: c.var.t("stock_opname.label.created_at"),
        width: 15,
      },
      {
        key: "created_by",
        header: c.var.t("stock_opname.label.created_by"),
        width: 40,
      },
      {
        key: "activity",
        header: c.var.t("stock_opname.label.activity"),
        width: 25,
      },
      {
        key: "period_start_date",
        header: c.var.t("stock_opname.label.period_start_date"),
        width: 20,
      },
      {
        key: "period_end_date",
        header: c.var.t("stock_opname.label.period_end_date"),
        width: 20,
      },
      {
        key: "period_status",
        header: c.var.t("stock_opname.label.period_status"),
        width: 20,
      },
      {
        key: "period",
        header: c.var.t("stock_opname.label.period"),
        width: 20,
      },
      {
        key: "docility",
        header: c.var.t("stock_opname.label.docility"),
        width: 15,
      },
    ]

    // Initialize exporter
    const exporter = new MultiSheetZipExporter({
      language,
      timezone: timezone,
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })
    const id = "stock-opname"
    const title = "Stock-Opname"

    exporter.initFileGroup(id, title)
    await exporter.initSheet(id, title)
    exporter.setColumns(id, title, columns)

    // Append rows
    const stream = await this.repo.getListOpnameStream(c, params)
    const modifiedStream = this.transformStream(stream, (item) => ({
      entity_name: item.entity_name,
      province: item.province,
      regency: item.regency,
      material_name: item.material_name,
      batch_code: item.batch_code,
      expired_date: item.expired_date
        ? moment(item.expired_date).format("DD/MM/YYYY")
        : "",
      recorded_qty: item.recorded_qty,
      in_transit_qty: item.in_transit_qty,
      actual_qty: item.actual_qty,
      created_at: moment(item.created_at).format("DD/MM/YYYY HH:mm:ss"),
      full_name: item.full_name,
      activity_name: item.activity_name,
      start_date: item.start_date
        ? moment(item.start_date).format("DD/MM/YYYY")
        : "",
      end_date: item.end_date ? moment(item.end_date).format("DD/MM/YYYY") : "",
      period_status:
        item.period_status === 1
          ? c.var.t("stock_opname.label.active")
          : c.var.t("stock_opname.label.inactive"),
      period_name: formatPeriodName(
        item.month_period,
        item.year_period,
        language
      ),
      is_within_period:
        item.is_within_period === 1
          ? c.var.t("stock_opname.label.done_so")
          : c.var.t("stock_opname.label.not_so"),
    }))
    await exporter.addRows(id, title, modifiedStream)

    return exporter
  }
}
