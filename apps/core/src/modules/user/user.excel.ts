import { ROW_SHEET_USER } from "@/common/constants/users.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types"

export class UserTemplateXlsx extends BaseTemplate {
  constructor(
    chooseProcessor = PROCESSOR.XLSXPOPULATE,
    startRow = ROW_SHEET_USER,
    startSheet = 1
  ) {
    super(startRow, startSheet, chooseProcessor)
  }

  async setMasterList(name: string, rows: AsyncIterableIterator<object>) {
    return this.addRows(name, rows)
  }
}
