import { Command } from "commander"
import { dailyDownloadExportReception } from "./scripts/cron/download-report/daily-download-export-reception.js"
import { dailyDownloadExportStockMaterial } from "./scripts/cron/download-report/daily-download-export-stock-material.js"
import { dailyDownloadExportConsumption } from "./scripts/cron/download-report/daily-download-export-consumption.js"
import { dailyDownloadExportDiscard } from "./scripts/cron/download-report/daily-download-export-discard.js"
import { dailyDownloadExportExpiredMaterial } from "./scripts/cron/download-report/daily-download-export-expired-material.js"
import { weeklyDownloadExportLoggerMonitoring } from "./scripts/cron/download-report/weekly-download-export-logger-monitoring.js"
import { monthlyDownloadExportLoggerMonitoring } from "./scripts/cron/download-report/monthly-download-export-logger-monitoring.js"
import { monthlyDownloadExportStockAvailability } from "./scripts/cron/download-report/monthly-download-export-stock-availability.js"

const program = new Command()

program
  .command("daily-download-export-reception")
  .description("Run daily download export reception")
  .action(async () => await dailyDownloadExportReception())

program
  .command("daily-download-export-stock-material")
  .description("Run daily download export stock material")
  .action(async () => await dailyDownloadExportStockMaterial())

program
  .command("daily-download-export-consumption")
  .description("Run daily download consumption material")
  .action(async () => await dailyDownloadExportConsumption())

program
  .command("daily-download-export-discard")
  .description("Run daily download discard material")
  .action(async () => await dailyDownloadExportDiscard())

program
  .command("daily-download-export-expired-material")
  .description("Run daily download expired material")
  .action(async () => await dailyDownloadExportExpiredMaterial())

program
  .command("monthly-download-export-stock-availability")
  .description(
    "Run monthly download export stock availability (previous month by default)"
  )
  .option("-m, --month <month>", "Month (1-12)")
  .option("-y, --year <year>", "Year (e.g., 2024)")
  .action(async (options) => {
    const month = options.month ? parseInt(options.month) : undefined
    const year = options.year ? parseInt(options.year) : undefined
    await monthlyDownloadExportStockAvailability(month, year)
  })

program
  .command("weekly-download-export-logger-monitoring")
  .description("Run weekly download export logger monitoring (last 7 days)")
  .action(async () => await weeklyDownloadExportLoggerMonitoring())

program
  .command("monthly-download-export-logger-monitoring")
  .description(
    "Run monthly download export logger monitoring (previous month by default)"
  )
  .option("-m, --month <month>", "Month (1-12)")
  .option("-y, --year <year>", "Year (e.g., 2024)")
  .action(async (options) => {
    const month = options.month ? parseInt(options.month) : undefined
    const year = options.year ? parseInt(options.year) : undefined
    await monthlyDownloadExportLoggerMonitoring(month, year)
  })

program.parse()
