import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { DownloadReportRepository } from "../download-report.repository.js"
import {
  ColumnExcel,
  ConfigProgram,
  ExcelProvinceOrRegencyGroupedDTO,
  StockMaterialBacthDTO,
} from "../download-report.schema.js"
import moment from "moment-timezone"
import { ExcelZipExporter } from "../download-report.excel-zip.js"
import { env } from "process"

export class StockMaterialGenerateReport {
  constructor(private readonly repo: DownloadReportRepository) {}

  async handleStockMaterialByProvince(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = configProgram.material.is_hierarchy_enabled
    return this.handleStockMaterial(c, lang, programId, isHierarchyEnabled, {
      state: "province",
      code: "43",
      titleKey: "download-report.name.43",
      provinceId,
      regencyId,
      printBy,
    })
  }

  async handleStockMaterialByRegency(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = configProgram.material.is_hierarchy_enabled
    return this.handleStockMaterial(c, lang, programId, isHierarchyEnabled, {
      state: "regency",
      code: "44",
      titleKey: "download-report.name.44",
      provinceId,
      regencyId,
      printBy,
    })
  }

  async handleStockMaterialByBatch(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = configProgram.material.is_hierarchy_enabled
    return this.handleStockMaterialCSV(c, lang, programId, isHierarchyEnabled, {
      state: "batch",
      code: "45",
      titleKey: "download-report.name.45",
      provinceId,
      regencyId,
      printBy,
    })
  }

  private readonly handleStockMaterial = async (
    c: Context<DB>,
    lang: string,
    programId: number,
    isHierarchyEnabled: boolean,
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
    const sheet = c.var.t("download-report.sheet.summary")

    const [materials, stockMaterials] = await Promise.all([
      this.repo.getMaterial(c, programId, isHierarchyEnabled),
      this.repo.getStockMaterialProvinceOrRegency(
        programId,
        options.state,
        isHierarchyEnabled,
        options.provinceId,
        options.regencyId
      ),
    ])

    const exportGroup = {
      id: title,
      name: title.replace(/\//g, " "),
      sheets: {
        summary: {
          sheetName: sheet,
        },
      },
      columns: {
        summary: this.getColumnsExcel(c, options.state, materials),
      },
    }

    exporter.setTimezone("Asia/Jakarta")
    exporter.initFileGroup(exportGroup.id, exportGroup.name)
    await exporter.initSheet(
      exportGroup.id,
      exportGroup.sheets.summary.sheetName
    )
    exporter.setHeader(
      exportGroup.id,
      exportGroup.sheets.summary.sheetName,
      c.var.t,
      "",
      options.printBy
    )
    exporter.setColumns(
      exportGroup.id,
      exportGroup.sheets.summary.sheetName,
      exportGroup.columns.summary.map((col) => ({
        ...col,
        key: typeof col.key === "number" ? String(col.key) : col.key,
      })),
      "A4"
    )
    await exporter.addRowWithHeaderMaterialAndKey(
      exportGroup.id,
      exportGroup.sheets.summary.sheetName,
      exportGroup.columns.summary,
      stockMaterials as ExcelProvinceOrRegencyGroupedDTO
    )
    await exporter.generateAndSaveZipFile(filePath)

    return {
      status: true,
      filename: `${title} ${exporter.getFormatDate()}.zip`,
      filePath,
    }
  }

  private readonly handleStockMaterialCSV = async (
    c: Context<DB>,
    lang: string,
    programId: number,
    isHierarchyEnabled: boolean,
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
    const timeZone = "Asia/Jakarta"
    const title: string = c.var.t(options.titleKey)
    const filePath: string = `${lang}_${options.code}_${crypto.randomUUID()}.zip`
    const sheet = c.var.t("download-report.sheet.detail")

    const exportGroup = {
      id: title,
      name: title.replace(/\//g, " "),
      sheets: {
        detail: {
          sheetName: sheet,
        },
      },
      columns: {
        detail: [
          {
            key: "no",
            header: c.var.t("download-report.column.no"),
            width: 10,
          },
          {
            key: "provinceId",
            header: c.var.t("download-report.column.province_id"),
            width: 30,
          },
          {
            key: "provinceName",
            header: c.var.t("download-report.column.province_name"),
            width: 30,
          },
          {
            key: "regencyId",
            header: c.var.t("download-report.column.regency_id"),
            width: 30,
          },
          {
            key: "regencyName",
            header: c.var.t("download-report.column.regency_name"),
            width: 30,
          },
          {
            key: "entityName",
            header: c.var.t("download-report.column.entity_name"),
            width: 30,
          },
          {
            key: "material",
            header: c.var.t("download-report.column.material"),
            width: 30,
          },
          {
            key: "activity",
            header: c.var.t("download-report.column.activity"),
            width: 30,
          },
          {
            key: "batchCode",
            header: c.var.t("download-report.column.batch_code"),
            width: 30,
          },
          {
            key: "expiredDate",
            header: c.var.t("download-report.column.expired_date"),
            width: 20,
          },
          { key: "stock", header: c.var.t("common.stock"), width: 15 },
          {
            key: "printBy",
            header: c.var.t("download-report.header.print_by"),
            width: 25,
          },
          {
            key: "dataUpdate",
            header: c.var.t("download-report.header.data_update"),
            width: 25,
          },
        ],
      },
    }

    exporter.setTimezone(timeZone)
    exporter.initFileGroup(exportGroup.id, exportGroup.name)
    await exporter.initSheet(
      exportGroup.id,
      exportGroup.sheets.detail.sheetName
    )
    exporter.setHeader(
      exportGroup.id,
      exportGroup.sheets.detail.sheetName,
      c.var.t,
      "",
      options.printBy
    )
    exporter.setColumns(
      exportGroup.id,
      exportGroup.sheets.detail.sheetName,
      exportGroup.columns.detail.map((col) => ({
        ...col,
        key: typeof col.key === "number" ? String(col.key) : col.key,
      })),
      "A4"
    )
    await exporter.addRows(
      exportGroup.id,
      exportGroup.sheets.detail.sheetName,
      [{}, {}, {}]
    )

    const rows: Record<string, unknown>[] = []
    const currentDate = new Date()
    const limit = 10000
    let indexRow: number = 1
    let offset = 0
    let hasMore = true
    while (hasMore) {
      const stockMaterialBatch = (await this.repo.getStockMaterialBatch(
        programId,
        options.state,
        options.provinceId,
        options.regencyId,
        offset,
        limit
      )) as StockMaterialBacthDTO[]
      if (stockMaterialBatch.length === 0) {
        hasMore = false
        break
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      stockMaterialBatch.forEach((item, _) => {
        const row = {
          index: indexRow++,
          provinceId: item.provinceId,
          provinceName: item.provinceName,
          regencyId: item.regencyId,
          regencyName: item.regencyName,
          entityName: item.entityName,
          material: item.materialName.replace(/,\s*/g, "-"),
          activity: item.activityName,
          batchCode: item.batchCode,
          expiredDate: item.expirationDate,
          stock: item.total,
          printBy: options.printBy ?? "Administrator",
          dataUpdate: moment(currentDate)
            .tz(timeZone)
            .format("YYYY-MM-DD HH:mm:ss"),
        }

        rows.push(row)
      })

      await exporter.addRows(
        exportGroup.id,
        exportGroup.sheets.detail.sheetName,
        rows
      )

      offset += rows.length
      if (rows.length < limit) {
        hasMore = false // berarti data sudah habis
      }
    }

    await exporter.generateAndSaveZipFile(filePath)

    return {
      status: true,
      filename: `${title} ${exporter.getFormatDate()}.zip`,
      filePath,
    }
  }

  getColumnsExcel = (
    c: Context<DB>,
    state: string,
    materials: ColumnExcel[]
  ): ColumnExcel[] => {
    return [
      { key: "no", header: c.var.t("download-report.column.no"), width: 10 },
      {
        key: "provinceId",
        header: c.var.t("download-report.column.province_id"),
        width: 30,
      },
      {
        key: "provinceName",
        header: c.var.t("download-report.column.province_name"),
        width: 30,
      },
      ...(state === "regency"
        ? [
            {
              key: "regencyId",
              header: c.var.t("download-report.column.regency_id"),
              width: 30,
            },
            {
              key: "regencyName",
              header: c.var.t("download-report.column.regency_name"),
              width: 30,
            },
          ]
        : []),
      ...materials,
      {
        key: "grandTotal",
        header: c.var.t("download-report.column.grand_total"),
        width: 30,
      },
    ]
  }
}
