import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import moment from "moment-timezone"
import { DownloadReportRepository } from "../download-report.repository.js"
import { DiscardGenerateReport } from "../generate-report/discard.generate-report.js"
import { getConfigProgram, processAndUpload } from "../download-report.util.js"
import { ConfigProgram } from "../download-report.schema.js"

export class DownloadReportDiscardCron {
  constructor(
    private readonly repo: DownloadReportRepository,
    private readonly generate: DiscardGenerateReport
  ) {}

  // code 49
  private readonly CATEGORY_ID = 5

  public readonly handleReportDiscard = async (
    c: Context<DB>,
    lang: string
  ) => {
    console.log("=== Start Process Report Discard ===", lang)
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const programs = await this.repo.getAllProgram(c)

    for (const program of programs) {
      const programId = program.id
      const configProgram: ConfigProgram = getConfigProgram(program)
      console.log("Program ID:", programId)

      // 49
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "49",
        this.CATEGORY_ID,
        this.generate.handleDiscard.bind(this.generate)
      )
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process Report Discard ===", lang)
  }
}
