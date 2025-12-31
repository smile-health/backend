import { ROW_SHEET_MATERIAL } from "@/common/constants/material.js"
import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import path from "path"

export class WhoPqsExcel extends BaseTemplate {
  constructor(
    processor = PROCESSOR.XLSXPOPULATE,
    startRow = ROW_SHEET_MATERIAL,
    startSheet = 1
  ) {
    super(startRow, startSheet, processor)
  }

  async setRows(sheet: string, rows: AsyncIterableIterator<object> | object[]) {
    return this.addRows(sheet, rows)
  }
}
