import { db } from "@/common/infrastructure/database/index.js"
import { DownloadReportDiscardCron } from "@/modules/download-report/cron/discard.cron.js"
import { DownloadReportQuery } from "@/modules/download-report/download-report.query.js"
import { DownloadReportRepository } from "@/modules/download-report/download-report.repository.js"
import { DiscardGenerateReport } from "@/modules/download-report/generate-report/discard.generate-report.js"
import { TransactionManager } from "@smile/lib/database.js"
import i18n from "@smile/lib/i18n.js"
import { CustomContext } from "@smile/lib/types/context.js"

export const dailyDownloadExportDiscard = async () => {
  const downloadReportRepo = new DownloadReportRepository(
    new DownloadReportQuery()
  )
  const downloadReportDiscardCron = new DownloadReportDiscardCron(
    new DownloadReportRepository(new DownloadReportQuery()),
    new DiscardGenerateReport(downloadReportRepo)
  )

  try {
    await new TransactionManager(db).transaction(async (trx) => {
      const languages = ["en", "id"]
      for (const lang of languages) {
        const translator = i18n.cloneInstance()
        translator.changeLanguage(lang)
        const c = new CustomContext({ trx, t: translator.t })
        await downloadReportDiscardCron.handleReportDiscard(c, lang)
      }
    })

    console.log("✅ Transaction committed")
    process.exit(0)
  } catch (error) {
    console.error("❌ Transaction failed", error)
    process.exit(1)
  }
}
