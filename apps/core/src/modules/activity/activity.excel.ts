import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import path from "path"

export class ActivityExcel extends BaseTemplate {
  constructor(
    startRow = 10,
    startSheet = 1,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
  }

  async loadFile(fileName: string) {
    await this.loadFromFile(
      path.resolve("public", "templates", "activity", fileName)
    )
  }
}
