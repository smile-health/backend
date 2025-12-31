import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import path from "path"

export class ReconciliationTemplate extends BaseTemplate {
  constructor(
    startRow = 10,
    startSheet = 1,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
  }

  async setRows(sheet: string, rows: AsyncIterableIterator<object> | object[]) {
    return this.addRows(sheet, rows)
  }

  async loadFile(language: string) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "reconciliation",
      `reconciliation_template_${language}.xlsx`
    )

    await this.loadFromFile(templatePath)
  }
}
