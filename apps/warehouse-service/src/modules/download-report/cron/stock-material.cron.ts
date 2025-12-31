import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import moment from "moment-timezone"
import { DownloadReportRepository } from "../download-report.repository.js"
import { StockMaterialGenerateReport } from "../generate-report/stock-material.generate-report.js"
import { ConfigProgram } from "../download-report.schema.js"
import { getConfigProgram, processAndUpload } from "../download-report.util.js"
export class DownloadReportStockMaterialCron {
  constructor(
    private readonly repo: DownloadReportRepository,
    private readonly generate: StockMaterialGenerateReport
  ) {}

  // code 43, 44, 45
  private readonly CATEGORY_ID = 2

  public readonly handleReportStockMaterial = async (
    c: Context<DB>,
    lang: string
  ) => {
    console.log("=== Start Process Report Stock Material ===", lang)
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const programs = await this.repo.getAllProgram(c)

    for (const program of programs) {
      const programId = program.id
      const configProgram: ConfigProgram = getConfigProgram(program)
      console.log("Program ID:", programId)

      // 43
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "43",
        this.CATEGORY_ID,
        this.generate.handleStockMaterialByProvince.bind(this.generate)
      )
      // 44
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "44",
        this.CATEGORY_ID,
        this.generate.handleStockMaterialByRegency.bind(this.generate)
      )
      // 45
      await processAndUpload(
        c,
        lang,
        programId,
        configProgram,
        "45",
        this.CATEGORY_ID,
        this.generate.handleStockMaterialByBatch.bind(this.generate)
      )
    }

    console.log("End Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Process Report Stock Material ===", lang)
  }
}
