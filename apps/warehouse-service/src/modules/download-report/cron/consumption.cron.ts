import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import moment from "moment-timezone"
import { DownloadReportRepository } from "../download-report.repository.js"
import { ConsumptionGenerateReport } from "../generate-report/consumption.generate-report.js"
import { ConfigProgram } from "../download-report.schema.js"
import { getConfigProgram, processAndUpload } from "../download-report.util.js"

export class DownloadReportConsumptionCron {
  constructor(
    private readonly repo: DownloadReportRepository,
    private readonly generate: ConsumptionGenerateReport
  ) {}

  // code 46,47,48
  private readonly CATEGORY_ID = 3

  public readonly handleReportConsumption = async (
    c: Context<DB>,
    lang: string
  ) => {
    console.log("=== Start Process Report Consumption ===", lang)
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const programs = await this.repo.getAllProgram(c)

    for (const program of programs) {
      const programId = program.id
      const configProgram: ConfigProgram = getConfigProgram(program)
      console.log("Program ID:", programId)

      // 46
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "46",
        this.CATEGORY_ID,
        this.generate.handleConsumptionByProvince.bind(this.generate)
      )

      // 47
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "47",
        this.CATEGORY_ID,
        this.generate.handleConsumptionByRegency.bind(this.generate)
      )

      // 48
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "48",
        this.CATEGORY_ID,
        this.generate.handleConsumptionByEntity.bind(this.generate)
      )
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process Report Consumption ===", lang)
  }
}
