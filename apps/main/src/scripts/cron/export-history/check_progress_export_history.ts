import { ExportHistoryCron } from "@/modules/export-history/export-history.cron.js"
import ExportHistoryRepository from "@/modules/export-history/export-history.repository.js"

export const checkProgressExportHistory = async () => {
  const exportHistoryCron = new ExportHistoryCron(new ExportHistoryRepository())
  await exportHistoryCron.checkProgress()
  process.exit(0)
}
