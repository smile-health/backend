import { db } from "@/common/infrastructure/database/index.js"
import { DownloadReportReceptionCron } from "@/modules/download-report/cron/reception.cron.js"
import { DownloadReportQuery } from "@/modules/download-report/download-report.query.js"
import { DownloadReportRepository } from "@/modules/download-report/download-report.repository.js"
import { ReceptionGenerateReport } from "@/modules/download-report/generate-report/reception.generate-report.js"
import { TransactionManager } from "@smile/lib/database.js"
import i18n from "@smile/lib/i18n.js"
import { CustomContext } from "@smile/lib/types/context.js"

export const dailyDownloadExportReception = async () => {
  const downloadReportRepo = new DownloadReportRepository(
    new DownloadReportQuery()
  )
  const downloadReportReceptionCron = new DownloadReportReceptionCron(
    new DownloadReportRepository(new DownloadReportQuery()),
    new ReceptionGenerateReport(downloadReportRepo)
  )

  try {
    await new TransactionManager(db).transaction(async (trx) => {
      const languages = ["en", "id"]
      for (const lang of languages) {
        const translator = i18n.cloneInstance()
        translator.changeLanguage(lang)
        const c = new CustomContext({ trx, t: translator.t })
        await downloadReportReceptionCron.handleReportReception(c, lang)
      }
    })

    console.log("✅ Transaction committed")
    process.exit(0)
  } catch (error) {
    console.error("❌ Transaction failed", error)
    process.exit(1)
  }
}
