import { db } from "@/common/infrastructure/database/index.js"
import { DownloadReportStockMaterialCron } from "@/modules/download-report/cron/stock-material.cron.js"
import { DownloadReportQuery } from "@/modules/download-report/download-report.query.js"
import { DownloadReportRepository } from "@/modules/download-report/download-report.repository.js"
import { StockMaterialGenerateReport } from "@/modules/download-report/generate-report/stock-material.generate-report.js"
import { TransactionManager } from "@smile-health/lib/database.js"
import i18n from "@smile-health/lib/i18n.js"
import { CustomContext } from "@smile-health/lib/types/context.js"

export const dailyDownloadExportStockMaterial = async () => {
  const downloadReportRepo = new DownloadReportRepository(
    new DownloadReportQuery()
  )
  const downloadReportStockMaterialCron = new DownloadReportStockMaterialCron(
    new DownloadReportRepository(new DownloadReportQuery()),
    new StockMaterialGenerateReport(downloadReportRepo)
  )

  try {
    await new TransactionManager(db).transaction(async (trx) => {
      const languages = ["en", "id"]
      for (const lang of languages) {
        const translator = i18n.cloneInstance()
        translator.changeLanguage(lang)
        const c = new CustomContext({ trx, t: translator.t })
        await downloadReportStockMaterialCron.handleReportStockMaterial(c, lang)
      }
    })

    console.log("✅ Transaction committed")
    process.exit(0)
  } catch (error) {
    console.error("❌ Transaction failed", error)
    process.exit(1)
  }
}
