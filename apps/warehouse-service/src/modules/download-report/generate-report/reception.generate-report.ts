import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { DownloadReportRepository } from "../download-report.repository.js"
import { ConfigProgram } from "../download-report.schema.js"
import { ExcelZipExporter } from "../download-report.excel-zip.js"
import env from "@/config/env.js"

export class ReceptionGenerateReport {
  constructor(private readonly repo: DownloadReportRepository) {}

  async handleReceptionNotAccepted(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    return this.handleReceptionReport(c, lang, programId, {
      state: "receptionNotAccepted",
      code: "56",
      titleKey: "download-report.name.56",
      provinceId,
      regencyId,
      printBy,
    })
  }

  async handleReceptionAcceptedFromMOH(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    return this.handleReceptionReport(c, lang, programId, {
      state: "receptionAcceptedFromMOH",
      code: "57",
      titleKey: "download-report.name.57",
      provinceId,
      regencyId,
      printBy,
    })
  }

  async handleReceptionNotAcceptedByExpired(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    return this.handleReceptionReport(c, lang, programId, {
      state: "receptionNotAcceptedByExpired",
      code: "58",
      titleKey: "download-report.name.58",
      provinceId,
      regencyId,
      printBy,
    })
  }

  private readonly handleReceptionReport = async (
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
    const [responseSummary, responseDetail] = (await Promise.all([
      this.repo.getReception(
        "summary",
        programId,
        options.state,
        options.provinceId,
        options.regencyId
      ),
      this.repo.getReception(
        "detail",
        programId,
        options.state,
        options.provinceId,
        options.regencyId
      ),
    ])) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>]
    // setup excel
    const exporter = new ExcelZipExporter({
      language: lang,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })
    const title: string = c.var.t(options.titleKey)
    const filePath: string = `${crypto.randomUUID()}.zip`
    const sheetSummary = c.var.t("download-report.sheet.summary")
    const sheetDetail = c.var.t("download-report.sheet.detail")
    const exportGroup = {
      id: title,
      name: title,
      sheets: {
        summary: {
          sheetName: sheetSummary,
        },
        detail: {
          sheetName: sheetDetail,
        },
      },
      columns: {
        summary: this.getColumnsExcel(c, "summary"),
        detail: this.getColumnsExcel(c, "detail"),
      },
    }

    exporter.setTimezone("Asia/Jakarta")
    exporter.initFileGroup(exportGroup.id, exportGroup.name)
    // init sheet
    await exporter.initSheet(
      exportGroup.id,
      exportGroup.sheets.summary.sheetName
    )
    await exporter.initSheet(
      exportGroup.id,
      exportGroup.sheets.detail.sheetName
    )
    // set header
    exporter.setHeader(
      exportGroup.id,
      exportGroup.sheets.summary.sheetName,
      c.var.t,
      options.code,
      options.printBy
    )
    exporter.setHeader(
      exportGroup.id,
      exportGroup.sheets.detail.sheetName,
      c.var.t,
      options.code,
      options.printBy
    )
    // set column
    exporter.setColumns(
      exportGroup.id,
      exportGroup.sheets.summary.sheetName,
      exportGroup.columns.summary,
      "A4"
    )
    exporter.setColumns(
      exportGroup.id,
      exportGroup.sheets.detail.sheetName,
      exportGroup.columns.detail,
      "A4"
    )
    // set default
    await Promise.all([
      exporter.addRows(exportGroup.id, exportGroup.sheets.summary.sheetName, [
        {},
        {},
        {},
      ]),
      exporter.addRows(exportGroup.id, exportGroup.sheets.detail.sheetName, [
        {},
        {},
        {},
      ]),
    ])
    // add data
    await Promise.all([
      exporter.addRows(
        exportGroup.id,
        exportGroup.sheets.summary.sheetName,
        responseSummary.map((item, index) => ({ no: index + 1, ...item }))
      ),
      exporter.addRows(
        exportGroup.id,
        exportGroup.sheets.detail.sheetName,
        responseDetail.map((item, index) => ({ no: index + 1, ...item }))
      ),
    ])

    await exporter.generateAndSaveZipFile(filePath)

    return {
      status: true,
      filename: `${title} ${exporter.getFormatDate()}.zip`,
      filePath,
    }
  }

  getColumnsExcel = (c: Context<DB>, state: string) => {
    return [
      { header: c.var.t("download-report.column.no"), width: 10 },
      {
        header: c.var.t("download-report.column.province_id"),
        width: 10,
      },
      {
        header: c.var.t("download-report.column.province_name"),
        width: 30,
      },
      {
        header: c.var.t("download-report.column.regency_id"),
        width: 10,
      },
      {
        header: c.var.t("download-report.column.regency_name"),
        width: 30,
      },
      {
        header: c.var.t("download-report.column.recipient_entity"),
        width: 30,
      },
      {
        header: c.var.t("download-report.column.healthcare_center_code"),
        width: 30,
      },
      {
        header: c.var.t("download-report.column.material"),
        width: 30,
      },
      ...(state !== "summary"
        ? [
            { header: c.var.t("download-report.column.activity"), width: 30 },
            { header: c.var.t("download-report.column.batch_code"), width: 30 },
            {
              header: c.var.t("download-report.column.expired_date"),
              width: 30,
            },
            {
              header: c.var.t("download-report.column.delivery_number"),
              width: 30,
            },
            { header: c.var.t("download-report.column.order_id"), width: 30 },
            { header: c.var.t("download-report.column.shipped_at"), width: 30 },
            {
              header: c.var.t("download-report.column.shipper_entity"),
              width: 30,
            },
          ]
        : []),
      { header: c.var.t("download-report.column.qty"), width: 30 },
    ]
  }
}
