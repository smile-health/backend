import { db } from "@/common/infrastructure/database/index.js"
import { DownloadReportConsumptionCron } from "@/modules/download-report/cron/consumption.cron.js"
import { DownloadReportQuery } from "@/modules/download-report/download-report.query.js"
import { DownloadReportRepository } from "@/modules/download-report/download-report.repository.js"
import { ConsumptionGenerateReport } from "@/modules/download-report/generate-report/consumption.generate-report.js"
import { TransactionManager } from "@smile-health/lib/database.js"
import i18n from "@smile-health/lib/i18n.js"
import { CustomContext } from "@smile-health/lib/types/context.js"

export const dailyDownloadExportConsumption = async () => {
  const downloadReportRepo = new DownloadReportRepository(
    new DownloadReportQuery()
  )
  const downloadReportConsumptionCron = new DownloadReportConsumptionCron(
    new DownloadReportRepository(new DownloadReportQuery()),
    new ConsumptionGenerateReport(downloadReportRepo)
  )

  try {
    await new TransactionManager(db).transaction(async (trx) => {
      const languages = ["en", "id"]
      for (const lang of languages) {
        const translator = i18n.cloneInstance()
        translator.changeLanguage(lang)
        const c = new CustomContext({ trx, t: translator.t })
        await downloadReportConsumptionCron.handleReportConsumption(c, lang)
      }
    })

    console.log("✅ Transaction committed")
    process.exit(0)
  } catch (error) {
    console.error("❌ Transaction failed", error)
    process.exit(1)
  }
}
