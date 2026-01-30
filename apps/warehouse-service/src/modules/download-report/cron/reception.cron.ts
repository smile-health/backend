import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import moment from "moment-timezone"
import { DownloadReportRepository } from "../download-report.repository.js"
import { ReceptionGenerateReport } from "../generate-report/reception.generate-report.js"
import { getConfigProgram, processAndUpload } from "../download-report.util.js"
import { ConfigProgram } from "../download-report.schema.js"

export class DownloadReportReceptionCron {
  constructor(
    private readonly repo: DownloadReportRepository,
    private readonly generate: ReceptionGenerateReport
  ) {}

  // CODE 56, 57, 58
  private readonly CATEGORY_ID = 1

  public readonly handleReportReception = async (
    c: Context<DB>,
    lang: string
  ) => {
    console.log("=== Start Process Report Reception ===", lang)
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const programs = await this.repo.getAllProgram(c)

    for (const program of programs) {
      const programId = program.id
      const configProgram: ConfigProgram = getConfigProgram(program)
      console.log("Program ID:", programId)

      // 56
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "56",
        this.CATEGORY_ID,
        this.generate.handleReceptionNotAccepted.bind(this.generate)
      )
      // 57
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "57",
        this.CATEGORY_ID,
        this.generate.handleReceptionAcceptedFromMOH.bind(this.generate)
      )
      // 58
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "58",
        this.CATEGORY_ID,
        this.generate.handleReceptionNotAcceptedByExpired.bind(this.generate)
      )
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process Report Reception ===", lang)
  }
}
