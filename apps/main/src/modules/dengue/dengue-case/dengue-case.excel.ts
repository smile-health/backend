import BaseTemplate from "@smile-health/lib/excel/index.js"
import path from "path"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"

export class DengueCaseTemplate extends BaseTemplate {
  constructor(startRow = 10, startSheet = 1, processor = PROCESSOR.XLSXPOPULATE) {
    super(startRow, startSheet, processor)
  }

  async loadFile(fileName: string): Promise<void> {
    const templatePath = path.resolve(
      "public",
      "templates",
      "dengue-case-report",
      fileName
    )
    return this.loadFromFile(templatePath)
  }
}
