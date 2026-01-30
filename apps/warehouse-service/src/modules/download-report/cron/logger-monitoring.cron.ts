import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import moment from "moment-timezone"
import { DownloadReportRepository } from "../download-report.repository.js"
import { LoggerMonitoringGenerateReport } from "../generate-report/logger-monitoring.generate-report.js"
import { ConfigProgram } from "../download-report.schema.js"
import { getConfigProgram, processAndUpload } from "../download-report.util.js"

export class DownloadReportLoggerMonitoringCron {
  constructor(
    private readonly repo: DownloadReportRepository,
    private readonly generate: LoggerMonitoringGenerateReport
  ) {}

  // code 59, 60
  private readonly CATEGORY_ID = 7 // Logger Monitoring category

  /**
   * Generate logger monitoring report for the last 7 days (Code 59)
   * This runs daily to provide recent logger monitoring data
   */
  public readonly handleReportLoggerMonitoringRecent = async (
    c: CustomContext<DB>,
    lang: string
  ) => {
    console.log(
      "=== Start Process Report Logger Monitoring Recent (7 Days) ===",
      lang
    )
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const programs = await this.repo.getAllProgram(c)

    for (const program of programs) {
      const programId = program.id

      if (programId === 1) {
        // Only process program id 1 (Imun)
        const configProgram: ConfigProgram = getConfigProgram(program)
        console.log("Program ID:", programId)

        // Generate report for code 59 (last 7 days)
        await processAndUpload(
          c,
          lang,
          programId,
          configProgram,
          "59",
          this.CATEGORY_ID,
          async (c, lang, programId, configProgram) => {
            const result = await this.generate.handleLoggerMonitoringRecent(
              c,
              lang,
              programId,
              configProgram
            )
            if (!result.status || !result.filePath) {
              throw new Error(
                "Failed to generate logger monitoring recent report"
              )
            }
            return { filePath: result.filePath }
          }
        )
      }
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log(
      "=== End Process Report Logger Monitoring Recent (7 Days) ===",
      lang
    )
  }

  /**
   * Generate logger monitoring report for a specific month (Code 60)
   * This runs monthly to provide historical logger monitoring data
   */
  public readonly handleReportLoggerMonitoringMonthly = async (
    c: CustomContext<DB>,
    lang: string,
    month?: number,
    year?: number
  ) => {
    // Default to previous month if not specified
    const targetDate =
      month && year
        ? moment()
            .year(year)
            .month(month - 1)
        : moment().subtract(1, "month")

    const targetMonth = targetDate.month() + 1 // moment months are 0-indexed
    const targetYear = targetDate.year()

    console.log(
      "=== Start Process Report Logger Monitoring Monthly ===",
      lang,
      `${targetYear}-${targetMonth}`
    )
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const programs = await this.repo.getAllProgram(c)

    for (const program of programs) {
      const programId = program.id

      if (programId === 1) {
        // Only process program id 1 (Imun)
        const configProgram: ConfigProgram = getConfigProgram(program)
        console.log("Program ID:", programId)

        // Generate report for code 60 (specific month)
        await processAndUpload(
          c,
          lang,
          programId,
          configProgram,
          "60",
          this.CATEGORY_ID,
          async (c, lang) => {
            const result = await this.generate.handleLoggerMonitoringMonthly(
              c,
              lang,
              targetMonth,
              targetYear
            )
            if (!result.status || !result.filePath) {
              throw new Error(
                "Failed to generate logger monitoring monthly report"
              )
            }
            return { filePath: result.filePath }
          }
        )
      }
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log(
      "=== End Process Report Logger Monitoring Monthly ===",
      lang,
      `${targetYear}-${targetMonth}`
    )
  }

  /**
   * Generate both recent and monthly logger monitoring reports
   * Useful for comprehensive scheduled generation
   */
  public readonly handleReportLoggerMonitoringAll = async (
    c: CustomContext<DB>,
    lang: string
  ) => {
    console.log("=== Start Process All Logger Monitoring Reports ===", lang)
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    // Generate recent report (last 7 days)
    await this.handleReportLoggerMonitoringRecent(c, lang)

    // Generate monthly report (previous month)
    await this.handleReportLoggerMonitoringMonthly(c, lang)

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process All Logger Monitoring Reports ===", lang)
  }
}
