import { db } from "@/common/infrastructure/database/index.js"
import { DownloadReportStockAvailabilityCron } from "@/modules/download-report/cron/stock-availability.cron.js"
import { DownloadReportQuery } from "@/modules/download-report/download-report.query.js"
import { DownloadReportRepository } from "@/modules/download-report/download-report.repository.js"
import { StockAvailabilityGenerateReport } from "@/modules/download-report/generate-report/stock-availability.generate-report.js"
import { StockInventoryRepository } from "@/modules/stock-inventory/stock-inventory.repository.js"
import { StockInventoryQuery } from "@/modules/stock-inventory/stock-inventory.query.js"
import { MaterialRepository } from "@/modules/material/material.repository.js"
import { MaterialQuery } from "@/modules/material/material.query.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { EntityQuery } from "@/modules/entity/entity.query.js"
import { AbnormalStockModule } from "@/modules/stock-inventory/abnormal-stock/abnormal-stock.module.js"
import { LocationModule } from "@/modules/location/location.module.js"
import { StockAvailabilityModule } from "@/modules/stock-inventory/stock-availability/stock-availability.module.js"
import { AbnormalStockExcel } from "@/modules/stock-inventory/abnormal-stock/abnormal-stock.excel.js"
import { StockAvailabilityExcel } from "@/modules/stock-inventory/stock-availability/stock-availability.excel.js"
import { RegionRepository } from "@/modules/region/region.repository.js"
import { EntityTagRepository } from "@/modules/entity-tag/entity-tag.repository.js"
import { RegionQuery } from "@/modules/region/region.query.js"
import { EntityTagQuery } from "@/modules/entity-tag/entity-tag.query.js"
import { TransactionManager } from "@smile-health/lib/database.js"
import i18n from "@smile-health/lib/i18n.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import moment from "moment-timezone"

export const monthlyDownloadExportStockAvailability = async (
  inputMonth?: number,
  inputYear?: number
) => {
  const downloadReportRepo = new DownloadReportRepository(
    new DownloadReportQuery()
  )

  const stockInventoryRepo = new StockInventoryRepository(
    new StockInventoryQuery()
  )
  const materialRepo = new MaterialRepository(new MaterialQuery())
  const entityRepo = new EntityRepository(new EntityQuery())
  const regionRepo = new RegionRepository(new RegionQuery())
  const entityTagRepo = new EntityTagRepository(new EntityTagQuery())
  const locationModule = new LocationModule(regionRepo, entityRepo)
  const stockAvailabilityExcel = new StockAvailabilityExcel(
    materialRepo,
    entityRepo,
    entityTagRepo,
    regionRepo
  )
  const stockAvailabilityModule = new StockAvailabilityModule(
    stockInventoryRepo,
    materialRepo,
    entityRepo,
    locationModule,
    stockAvailabilityExcel
  )
  const abnormalStockExcel = new AbnormalStockExcel(
    materialRepo,
    entityRepo,
    entityTagRepo,
    regionRepo
  )
  const abnormalStockModule = new AbnormalStockModule(
    stockInventoryRepo,
    materialRepo,
    entityRepo,
    regionRepo,
    locationModule,
    abnormalStockExcel
  )

  const stockAvailabilityGenerate = new StockAvailabilityGenerateReport(
    abnormalStockModule,
    stockAvailabilityModule
  )

  const downloadReportStockAvailabilityCron =
    new DownloadReportStockAvailabilityCron(
      downloadReportRepo,
      stockAvailabilityGenerate
    )

  // Use provided month/year or default to previous month
  let month: number
  let year: number

  if (inputMonth && inputYear) {
    month = inputMonth
    year = inputYear
  } else {
    const previousMonth = moment().subtract(1, "month")
    month = previousMonth.month() + 1 // moment months are 0-indexed
    year = previousMonth.year()
  }

  console.log(
    `📅 Processing report for: ${year}-${month.toString().padStart(2, "0")}`
  )

  try {
    await new TransactionManager(db).transaction(async (trx) => {
      const languages = ["en", "id"]
      for (const lang of languages) {
        const translator = i18n.cloneInstance()
        translator.changeLanguage(lang)

        const c = new CustomContext({
          trx,
          t: translator.t,
          "feature-flags": () => false,
          "feature-enabled": () => false,
        })

        await downloadReportStockAvailabilityCron.handleReportStockAvailability(
          c,
          lang,
          month,
          year
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
