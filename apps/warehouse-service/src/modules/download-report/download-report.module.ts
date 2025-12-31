import { Context } from "hono"
import { DownloadReportRepository } from "./download-report.repository.js"
import {
  codeParam,
  ConfigProgram,
  DownloadByCodeLocal,
  DownloadByCodeMinio,
  DownloadByCodeResult,
} from "./download-report.schema.js"
import { downloadFileFromMinio } from "./download-report.minio.js"
import { ReceptionGenerateReport } from "./generate-report/reception.generate-report.js"
import momentTZ from "moment-timezone"
import {
  convertFormatedDate,
  getFullnameUser,
  getProvinceAndRegency,
} from "./download-report.util.js"
import { StockMaterialGenerateReport } from "./generate-report/stock-material.generate-report.js"
import { ConsumptionGenerateReport } from "./generate-report/consumption.generate-report.js"
import { ForbiddenError } from "@smile/lib/error.js"
import { DiscardGenerateReport } from "./generate-report/discard.generate-report.js"
import { ExpiredMaterialGenerateReport } from "./generate-report/expired-material.generate-report.js"
import { StockAvailabilityGenerateReport } from "./generate-report/stock-availability.generate-report.js"
import { LoggerMonitoringGenerateReport } from "./generate-report/logger-monitoring.generate-report.js"

export class DownloadReportModule {
  constructor(
    private readonly downloadReportRepo: DownloadReportRepository,
    private readonly generatedReception: ReceptionGenerateReport,
    private readonly generatedStockMaterial: StockMaterialGenerateReport,
    private readonly generatedConsumption: ConsumptionGenerateReport,
    private readonly generatedDiscard: DiscardGenerateReport,
    private readonly generatedExpiredMaterial: ExpiredMaterialGenerateReport,
    private readonly generatedStockAvailability: StockAvailabilityGenerateReport,
    private readonly generatedLoggerMonitoring: LoggerMonitoringGenerateReport
  ) {}

  async list(c: Context) {
    const [categories, exportLogs] = await Promise.all([
      this.downloadReportRepo.getCategories(c),
      this.downloadReportRepo.getExportLogs(c),
    ])
    const response = categories.map((category) => {
      const exportLogsForCategory = exportLogs[category.id] || []
      return {
        id: category.id,
        title: c.var.t(`download-report.category.${category.title}`),
        list: exportLogsForCategory.map((log) => ({
          lang: log.lang,
          code: log.code,
          name: c.var.t(`download-report.name.${log.code}`, {
            month: c.var.t(`month.${log.month}`),
            year: log.year,
          }),
          month: log.month,
          year: log.year,
          category_id: log.export_category_id,
          created_at: log.created_at,
        })),
      }
    })
    return { data: response }
  }

  // get from minio if user is superadmin and entity type != 1,2,3
  async getExcelIfSuperadmin(
    c: Context,
    param: codeParam
  ): Promise<DownloadByCodeMinio> {
    const lang = c.var.language
    const programId = c.var.programId
    const result = await this.downloadReportRepo.getLastIdReportLogs(
      c,
      param.code,
      programId,
      lang,
      param.month,
      param.year
    )

    const filename = `download-report.name.${param.code}`
    const objectName = `reports/${lang}_${result?.id}_${filename}.zip`
    let fileBuffer: Buffer
    try {
      fileBuffer = await downloadFileFromMinio(objectName)
    } catch (error) {
      console.log(error)
      return {
        status: false,
      }
    }

    const currentTime = momentTZ().tz(c.req.header("timezone") ?? "UTC")
    return {
      status: true,
      filename: `${c.var.t(filename, {
        month: c.var.t(`month.${result?.month}`),
        year: result?.year,
      })} ${convertFormatedDate(currentTime)}`,
      buffer: fileBuffer,
    }
  }

  // generate report if user entity type = 1 2
  async generateExcelFilterByProvinceOrRegency(
    c: Context,
    param: codeParam
  ): Promise<DownloadByCodeLocal> {
    const programId = c.var.programId
    const lang = c.var.language
    const user = c.var.user
    const configProgram: ConfigProgram = user.programs.find(
      (p) => p.id === programId
    ).config
    const printBy = getFullnameUser(user)
    const { province_id, regency_id } = getProvinceAndRegency(user)
    switch (param.code) {
      case 41: {
        // Get month and year from params or default to current month/year
        const now = momentTZ()
        const month = param.month ?? now.month() + 1 // moment months are 0-indexed
        const year = param.year ?? now.year()
        return this.generatedStockAvailability.handleStockAvailabilityEntityMaterial(
          c,
          lang,
          programId,
          configProgram,
          month,
          year,
          province_id,
          regency_id,
          printBy
        )
      }
      case 43:
        return this.generatedStockMaterial.handleStockMaterialByProvince(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 44:
        return this.generatedStockMaterial.handleStockMaterialByRegency(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 45:
        return this.generatedStockMaterial.handleStockMaterialByBatch(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 46:
        return this.generatedConsumption.handleConsumptionByProvince(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 47:
        return this.generatedConsumption.handleConsumptionByRegency(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 48:
        return this.generatedConsumption.handleConsumptionByEntity(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 49:
        return this.generatedDiscard.handleDiscard(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 50:
        return this.generatedExpiredMaterial.handleExpiredMaterialByProvince(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 51:
        return this.generatedExpiredMaterial.handleExpiredMaterialByRegency(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 52:
        return this.generatedExpiredMaterial.handleExpiredMaterialByEntity(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 53:
        return this.generatedExpiredMaterial.handleExpiredMaterialNextMonthByEntity(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 54:
        return this.generatedExpiredMaterial.handleExpiredMaterialNextMonthByRegency(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 55:
        return this.generatedExpiredMaterial.handleExpiredMaterialNextMonthByEntity(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 56:
        return this.generatedReception.handleReceptionNotAccepted(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 57:
        return this.generatedReception.handleReceptionAcceptedFromMOH(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 58:
        return this.generatedReception.handleReceptionNotAcceptedByExpired(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 59:
        return this.generatedLoggerMonitoring.handleLoggerMonitoringRecent(
          c,
          lang,
          programId,
          configProgram,
          province_id,
          regency_id,
          printBy
        )
      case 60: {
        const now = momentTZ()
        const month = param.month ?? now.month() + 1
        const year = param.year ?? now.year()
        return this.generatedLoggerMonitoring.handleLoggerMonitoringMonthly(
          c,
          lang,
          month,
          year,
          province_id,
          regency_id,
          printBy
        )
      }
      default:
        return { status: false }
    }
  }

  async downloadByCode(
    c: Context,
    param: codeParam
  ): Promise<DownloadByCodeResult> {
    const user = c.var.user
    const isAllow = await this.downloadReportRepo.getPermissionExportRole(
      c,
      param.code,
      user.role_id
    )
    if (!isAllow) {
      throw new ForbiddenError(
        c.var.t("validator.download_report_dont_have_permisson", {
          code: param.code,
        })
      )
    }
    if (user.role_id === 1 && ![1, 2, 3].includes(user.entity.type)) {
      return this.getExcelIfSuperadmin(c, param)
    }
    return this.generateExcelFilterByProvinceOrRegency(c, param)
  }
}
