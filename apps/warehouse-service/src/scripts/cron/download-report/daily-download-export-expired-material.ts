import { db } from "@/common/infrastructure/database/index.js"
import { DownloadReportExpiredMaterialCron } from "@/modules/download-report/cron/expired-material.cron.js"
import { DownloadReportQuery } from "@/modules/download-report/download-report.query.js"
import { DownloadReportRepository } from "@/modules/download-report/download-report.repository.js"
import { ExpiredMaterialGenerateReport } from "@/modules/download-report/generate-report/expired-material.generate-report.js"
import { TransactionManager } from "@smile/lib/database.js"
import i18n from "@smile/lib/i18n.js"
import { CustomContext } from "@smile/lib/types/context.js"

export const dailyDownloadExportExpiredMaterial = async () => {
  const downloadReportRepo = new DownloadReportRepository(
    new DownloadReportQuery()
  )
  const downloadReportExpiredMaterialCron =
    new DownloadReportExpiredMaterialCron(
      new DownloadReportRepository(new DownloadReportQuery()),
      new ExpiredMaterialGenerateReport(downloadReportRepo)
    )

  try {
    await new TransactionManager(db).transaction(async (trx) => {
      const languages = ["en", "id"]
      for (const lang of languages) {
        const translator = i18n.cloneInstance()
        translator.changeLanguage(lang)
        const c = new CustomContext({ trx, t: translator.t })
        await downloadReportExpiredMaterialCron.handleReportExpiredMaterial(
          c,
          lang
        )
      }
    })

    console.log("✅ Transaction committed")
    process.exit(0)
  } catch (error) {
    console.error("❌ Transaction failed", error)
    process.exit(1)
  }
}
