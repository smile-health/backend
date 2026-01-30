import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { DownloadReportRepository } from "../download-report.repository.js"
import { ColumnExcel, ConfigProgram } from "../download-report.schema.js"
import env from "../../../config/env.js"
import { ExcelZipExporter } from "../download-report.excel-zip.js"

export class ConsumptionGenerateReport {
  constructor(private readonly repo: DownloadReportRepository) {}

  async handleConsumptionByProvince(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = configProgram.material.is_hierarchy_enabled
    return this.handleConsumption(c, lang, programId, isHierarchyEnabled, {
      state: "province",
      code: "46",
      titleKey: "download-report.name.46",
      provinceId,
      regencyId,
      printBy,
    })
  }

  async handleConsumptionByRegency(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = configProgram.material.is_hierarchy_enabled
    return this.handleConsumption(c, lang, programId, isHierarchyEnabled, {
      state: "regency",
      code: "47",
      titleKey: "download-report.name.47",
      provinceId,
      regencyId,
      printBy,
    })
  }

  async handleConsumptionByEntity(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = configProgram.material.is_hierarchy_enabled
    return this.handleConsumption(c, lang, programId, isHierarchyEnabled, {
      state: "entity",
      code: "48",
      titleKey: "download-report.name.48",
      provinceId,
      regencyId,
      printBy,
    })
  }

  private readonly handleConsumption = async (
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
    exporter.setTimezone("Asia/Jakarta")

    if (options.state !== "entity") {
      const sheetSummary = c.var.t("download-report.sheet.vendor")
      const [materials, consumptions] = await Promise.all([
        this.repo.getMaterial(c, programId, isHierarchyEnabled),
        this.repo.getConsumptionByProvinceOrRegency(
          programId,
          options.state,
          isHierarchyEnabled,
          options.provinceId,
          options.regencyId
        ),
      ])

      const entityGroup = {
        id: title,
        name: title,
        sheets: {
          entity: {
            sheetName: sheetSummary,
          },
        },
        columns: {
          entity: this.getColumnsExcel(c, options.state, materials),
        },
      }

      exporter.initFileGroup(entityGroup.id, entityGroup.name)
      await exporter.initSheet(
        entityGroup.id,
        entityGroup.sheets.entity.sheetName
      )
      exporter.setHeader(
        entityGroup.id,
        entityGroup.sheets.entity.sheetName,
        c.var.t,
        options.code,
        options.printBy
      )
      exporter.setColumns(
        entityGroup.id,
        entityGroup.sheets.entity.sheetName,
        entityGroup.columns.entity.map((col) => ({
          ...col,
          key: typeof col.key === "number" ? String(col.key) : col.key,
        })),
        "A4"
      )
      await exporter.addRowWithHeaderMaterialAndKey(
        entityGroup.id,
        entityGroup.sheets.entity.sheetName,
        entityGroup.columns.entity,
        consumptions
      )
      await exporter.generateAndSaveZipFile(filePath)
    } else {
      const sheetEntity = "Sheet 1"
      const entityGroup = {
        id: title,
        name: title,
        sheets: {
          entity: {
            sheetName: sheetEntity,
          },
        },
        columns: {
          entity: this.getColumnsExcel(c, options.state, []),
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
        entityGroup.columns.entity.map((col) => ({
          ...col,
          key: typeof col.key === "number" ? String(col.key) : col.key,
        }))
      )
      const consumptions = (await this.repo.getConsumptionByEntity(
        programId,
        options.provinceId,
        options.regencyId
      )) as Array<Record<string, unknown>>
      await exporter.addRows(
        entityGroup.id,
        entityGroup.sheets?.entity.sheetName,
        consumptions.map((value, index) => ({
          no: index + 1,
          ...value,
          transactionTypeKey: c.var.t(String(value.transactionTypeKey)),
        }))
      )
      await exporter.generateAndSaveZipFile(filePath)
    }

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
    if (state === "entity") {
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
