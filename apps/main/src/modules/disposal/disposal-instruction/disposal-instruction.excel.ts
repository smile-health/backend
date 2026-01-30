import path from "path"
import { Context } from "hono"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"

export class HandoverLetterExport extends BaseTemplate {
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
}

export class DetailHandoverLetterExport extends HandoverLetterExport {
  constructor() {
    super()
  }

  async loadFile(c: Context) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "disposal-instruction",
      `disposal_handover_letter_${c.var.language}.xlsx`
    )

    await this.loadFromFile(templatePath)
  }
}
