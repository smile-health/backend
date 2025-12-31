import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { DownloadReportRepository } from "../download-report.repository.js"
import { ColumnExcel, ConfigProgram } from "../download-report.schema.js"
import env from "../../../config/env.js"
import { ExcelZipExporter } from "../download-report.excel-zip.js"

export class DiscardGenerateReport {
  constructor(private readonly repo: DownloadReportRepository) {}

  async handleDiscard(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    return this.handleProcessDiscard(c, lang, programId, {
      state: "discard",
      code: "49",
      titleKey: "download-report.name.49",
      provinceId,
      regencyId,
      printBy,
    })
  }

  private readonly handleProcessDiscard = async (
    c: Context<DB>,
    lang: string,
    programId: number,
    options: {
      state: string
      code: string
      titleKey: string
      provinceId?: number
      regencyId?: number
      printBy?: string
    }
  ) => {
    // setup excel
    const exporter = new ExcelZipExporter({
      language: lang,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })
    const title: string = c.var.t(options.titleKey)
    const filePath: string = `${crypto.randomUUID()}.zip`
    const sheet = c.var.t("download-report.sheet.discard")
    const exportGroup = {
      id: title,
      name: title,
      sheets: {
        entity: {
          sheetName: sheet,
        },
      },
      columns: {
        entity: this.getColumnsExcel(c),
      },
    }

    exporter.setTimezone("Asia/Jakarta")
    exporter.initFileGroup(exportGroup.id, exportGroup.name)
    await exporter.initSheet(
      exportGroup.id,
      exportGroup.sheets.entity.sheetName
    )
    exporter.setHeader(
      exportGroup.id,
      exportGroup.sheets.entity.sheetName,
      c.var.t,
      "",
      options.printBy
    )
    exporter.setColumns(
      exportGroup.id,
      exportGroup.sheets.entity.sheetName,
      exportGroup.columns.entity.map((col) => ({
        ...col,
        key: typeof col.key === "number" ? String(col.key) : col.key,
      })),
      "A4"
    )

    const discards = (await this.repo.getDiscard(
      programId,
      options.provinceId,
      options.regencyId
    )) as Array<Record<string, unknown>>

    const discardMappeds = discards.map((item, index) => ({
      no: index + 1,
      ...item,
      transactionTypeKey: c.var.t(String(item.transactionTypeKey)),
    }))

    await exporter.addRows(
      exportGroup.id,
      exportGroup.sheets.entity.sheetName,
      [{}, {}, {}, ...discardMappeds]
    )

    await exporter.generateAndSaveZipFile(filePath)

    return {
      status: true,
      filename: `${title} ${exporter.getFormatDate()}.zip`,
      filePath,
    }
  }
  getColumnsExcel = (c: Context<DB>): ColumnExcel[] => {
    return [
      { key: "no", header: c.var.t("download-report.column.no"), width: 10 },
      {
        key: "vendor_province_id",
        header: c.var.t("download-report.column.vendor_province_id"),
        width: 10,
      },
      {
        key: "vendor_province_name",
        header: c.var.t("download-report.column.vendor_province_name"),
        width: 20,
      },
      {
        key: "vendor_regency_id",
        header: c.var.t("download-report.column.vendor_regency_id"),
        width: 10,
      },
      {
        key: "vendor_regency_name",
        header: c.var.t("download-report.column.vendor_regency"),
        width: 20,
      },
      {
        key: "entity_id",
        header: c.var.t("download-report.column.entity_id"),
        width: 20,
      },
      {
        key: "entity_name",
        header: c.var.t("download-report.column.entity_name"),
        width: 20,
      },
      {
        key: "material",
        header: c.var.t("download-report.column.material"),
        width: 20,
      },
      {
        key: "unit",
        header: c.var.t("download-report.column.unit"),
        width: 20,
      },
      {
        key: "batch_number",
        header: c.var.t("download-report.column.batch_number"),
        width: 20,
      },
      {
        key: "expired_date",
        header: c.var.t("download-report.column.expired_date"),
        width: 20,
      },
      {
        key: "manufactur_name",
        header: c.var.t("download-report.column.manufacture_name"),
        width: 20,
      },
      {
        key: "vendor_name",
        header: c.var.t("download-report.column.vendor_name"),
        width: 20,
      },
      {
        key: "customer_province_id",
        header: c.var.t("download-report.column.customer_province_id"),
        width: 10,
      },
      {
        key: "customer_province_name",
        header: c.var.t("download-report.column.customer_province_name"),
        width: 20,
      },
      {
        key: "customer_regency_id",
        header: c.var.t("download-report.column.customer_regency_id"),
        width: 10,
      },
      {
        key: "customer_regency_name",
        header: c.var.t("download-report.column.customer_regency_name"),
        width: 20,
      },
      {
        key: "customer_name",
        header: c.var.t("download-report.column.customer_name"),
        width: 20,
      },
      {
        key: "created_at",
        header: c.var.t("download-report.column.created_at"),
        width: 20,
      },
      {
        key: "transaction_type",
        header: c.var.t("download-report.column.transaction_type"),
        width: 20,
      },
      {
        key: "quantity",
        header: c.var.t("download-report.column.quantity"),
        width: 20,
      },
    ]
  }
}
