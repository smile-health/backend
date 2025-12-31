import path from "path"
import { Context } from "hono"
import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"

export class AnnualPlanningGroupTargetExcel extends BaseTemplate {
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

  async loadFile(c: Context, fileName: string): Promise<void> {
    const templatePath = path.resolve(
      "public",
      "templates",
      "annual-planning",
      fileName
    )

    await this.loadFromFile(templatePath)
  }
}
