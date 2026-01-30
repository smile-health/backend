import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { DownloadReportRepository } from "../download-report.repository.js"
import {
  ColumnExcel,
  ConfigProgram,
  ExcelProvinceOrRegencyGroupedDTO,
} from "../download-report.schema.js"
import { ExcelZipExporter } from "../download-report.excel-zip.js"
import env from "@/config/env.js"

export class ExpiredMaterialGenerateReport {
  constructor(private readonly repo: DownloadReportRepository) {}

  async handleExpiredMaterialByProvince(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = configProgram.material.is_hierarchy_enabled
    return this.handleProcessExpiredMaterial(
      c,
      lang,
      programId,
      isHierarchyEnabled,
      {
        state: "province",
        code: "50",
        titleKey: "download-report.name.50",
        provinceId,
        regencyId,
        printBy,
      }
    )
  }

  async handleExpiredMaterialByRegency(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = configProgram.material.is_hierarchy_enabled
    return this.handleProcessExpiredMaterial(
      c,
      lang,
      programId,
      isHierarchyEnabled,
      {
        state: "regency",
        code: "51",
        titleKey: "download-report.name.51",
        provinceId,
        regencyId,
        printBy,
      }
    )
  }

  async handleExpiredMaterialByEntity(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = false // because list always 93
    return this.handleProcessExpiredMaterial(
      c,
      lang,
      programId,
      isHierarchyEnabled,
      {
        state: "entity",
        code: "52",
        titleKey: "download-report.name.52",
        provinceId,
        regencyId,
        printBy,
      }
    )
  }

  async handleExpiredMaterialNextMonthByProvince(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = configProgram.material.is_hierarchy_enabled
    return this.handleProcessExpiredMaterial(
      c,
      lang,
      programId,
      isHierarchyEnabled,
      {
        state: "province-next",
        code: "53",
        titleKey: "download-report.name.53",
        provinceId,
        regencyId,
        printBy,
      }
    )
  }

  async handleExpiredMaterialNextMonthByRegency(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = configProgram.material.is_hierarchy_enabled
    return this.handleProcessExpiredMaterial(
      c,
      lang,
      programId,
      isHierarchyEnabled,
      {
        state: "regency-next",
        code: "54",
        titleKey: "download-report.name.54",
        provinceId,
        regencyId,
        printBy,
      }
    )
  }

  async handleExpiredMaterialNextMonthByEntity(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ) {
    const isHierarchyEnabled = false // because list always 93
    return this.handleProcessExpiredMaterial(
      c,
      lang,
      programId,
      isHierarchyEnabled,
      {
        state: "entity-next",
        code: "55",
        titleKey: "download-report.name.55",
        provinceId,
        regencyId,
        printBy,
      }
    )
  }

  private readonly handleProcessExpiredMaterial = async (
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
    const title: string = c.var.t("download-report.category.expired_material")
    const filePath: string = `${crypto.randomUUID()}.zip`
    const sheet = c.var.t("download-report.sheet.summary")

    const [materials, expiredMaterials] = await Promise.all([
      this.repo.getMaterial(c, programId, isHierarchyEnabled),
      this.repo.getExpiredMaterial(
        programId,
        options.state,
        isHierarchyEnabled,
        options.provinceId,
        options.regencyId
      ),
    ])

    const exportGroup = {
      id: title,
      name: title,
      sheets: {
        entity: {
          sheetName: sheet,
        },
      },
      columns: {
        entity: this.getColumnsExcel(c, options.state, materials),
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

    if (options.state.includes("entity")) {
      const expiredMaterialMapped = (
        expiredMaterials as Array<Record<string, unknown>>
      ).map((item, index) => ({
        no: index + 1,
        ...item,
      }))

      await exporter.addRows(
        exportGroup.id,
        exportGroup.sheets.entity.sheetName,
        [{}, {}, {}, ...expiredMaterialMapped]
      )
    } else {
      await exporter.addRowWithHeaderMaterialAndKey(
        exportGroup.id,
        exportGroup.sheets.entity.sheetName,
        exportGroup.columns.entity,
        expiredMaterials as ExcelProvinceOrRegencyGroupedDTO
      )
    }

    await exporter.generateAndSaveZipFile(filePath)

    return {
      status: true,
      filename: `${c.var.t(options.titleKey)} ${exporter.getFormatDate()}.zip`,
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
        width: 10,
      },
      {
        key: "provinceName",
        header: c.var.t("download-report.column.province_name"),
        width: 20,
      },
      ...(state.includes("regency") || state.includes("entity")
        ? [
            {
              key: "regencyId",
              header: c.var.t("download-report.column.regency_id"),
              width: 10,
            },
            {
              key: "regencyName",
              header: c.var.t("download-report.column.regency_name"),
              width: 20,
            },
          ]
        : []),
      ...(state.includes("entity")
        ? [
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
              key: "activity",
              header: c.var.t("download-report.column.activity"),
              width: 20,
            },
            {
              key: "batch_code",
              header: c.var.t("download-report.column.batch_code"),
              width: 20,
            },
            {
              key: "expired_date",
              header: c.var.t("download-report.column.expired_date"),
              width: 20,
            },
            {
              key: "stock",
              header: c.var.t("common.stock"),
              width: 20,
            },
          ]
        : [
            ...materials,
            {
              key: "grandTotal",
              header: c.var.t("download-report.column.grand_total"),
              width: 20,
            },
          ]),
    ]
  }
}
