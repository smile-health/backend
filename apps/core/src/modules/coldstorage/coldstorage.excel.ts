import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import path from "path"

export class ColdstorageExport extends BaseTemplate {
  constructor(startRow = 1, startSheet = 0, processor = PROCESSOR.EXCELJS) {
    super(startRow, startSheet, processor)
  }

  async loadFile(fileName: string) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "coldstorage",
      fileName
    )
    await this.loadFromFile(templatePath)
  }
}
