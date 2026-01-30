import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"

export class EntityCustomerTemplate extends BaseTemplate {
  constructor(startRow = 10, startSheet = 1, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }

  async setRows(sheet: string, rows: AsyncIterableIterator<object> | object[]) {
    return this.addRows(sheet, rows)
  }
}
