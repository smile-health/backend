import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import moment from "moment-timezone"
import { DownloadReportRepository } from "../download-report.repository.js"
import { StockAvailabilityGenerateReport } from "../generate-report/stock-availability.generate-report.js"
import { ConfigProgram } from "../download-report.schema.js"
import { getConfigProgram, processAndUpload } from "../download-report.util.js"

export class DownloadReportStockAvailabilityCron {
  constructor(
    private readonly repo: DownloadReportRepository,
    private readonly generate: StockAvailabilityGenerateReport
  ) {}

  // code 41
  private readonly CATEGORY_ID = 6

  public readonly handleReportStockAvailability = async (
    c: CustomContext<DB>,
    lang: string,
    month: number,
    year: number
  ) => {
    console.log(
      "=== Start Process Report Stock Availability Entity-Material ===",
      lang,
      `${year}-${month}`
    )
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const programs = await this.repo.getAllProgram(c)

    for (const program of programs) {
      const programId = program.id
      const configProgram: ConfigProgram = getConfigProgram(program)
      console.log("Program ID:", programId)

      // Generate report for code 41
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "41",
        this.CATEGORY_ID,
        async (c, lang, programId, configProgram) => {
          return this.generate.handleStockAvailabilityEntityMaterial(
            c,
            lang,
            programId,
            configProgram,
            month,
            year
          )
        },
        month,
        year
      )
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log(
      "=== End Process Report Stock Availability Entity-Material ===",
      lang,
      `${year}-${month}`
    )
  }
}
