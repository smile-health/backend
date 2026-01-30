import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import moment from "moment-timezone"
import { DownloadReportRepository } from "../download-report.repository.js"
import { ExpiredMaterialGenerateReport } from "../generate-report/expired-material.generate-report.js"
import { ConfigProgram } from "../download-report.schema.js"
import { getConfigProgram, processAndUpload } from "../download-report.util.js"

export class DownloadReportExpiredMaterialCron {
  constructor(
    private readonly repo: DownloadReportRepository,
    private readonly generate: ExpiredMaterialGenerateReport
  ) {}

  // code 50,51,52,53,54,55
  private readonly CATEGORY_ID = 4

  public readonly handleReportExpiredMaterial = async (
    c: Context<DB>,
    lang: string
  ) => {
    console.log("=== Start Process Report Expired Material ===", lang)
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const programs = await this.repo.getAllProgram(c)

    for (const program of programs) {
      const programId = program.id
      const configProgram: ConfigProgram = getConfigProgram(program)
      console.log("Program ID:", programId)

      // 50
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "50",
        this.CATEGORY_ID,
        this.generate.handleExpiredMaterialByProvince.bind(this.generate)
      )
      // 51
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "51",
        this.CATEGORY_ID,
        this.generate.handleExpiredMaterialByRegency.bind(this.generate)
      )
      // 52
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "52",
        this.CATEGORY_ID,
        this.generate.handleExpiredMaterialByEntity.bind(this.generate)
      )
      // 53
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "53",
        this.CATEGORY_ID,
        this.generate.handleExpiredMaterialNextMonthByProvince.bind(
          this.generate
        )
      )
      // 54
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "54",
        this.CATEGORY_ID,
        this.generate.handleExpiredMaterialNextMonthByRegency.bind(
          this.generate
        )
      )
      // 55
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "55",
        this.CATEGORY_ID,
        this.generate.handleExpiredMaterialNextMonthByEntity.bind(this.generate)
      )
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process Report Expired Material ===", lang)
  }
}
