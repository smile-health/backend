import { IMPORT_START_ROW } from "@/common/constants/manufacture.js"
import BaseTemplate from "@smile/lib/excel/index.js"

export class ManufactureTemplateXlsx extends BaseTemplate {
  constructor(
    chooseProcessor: number,
    startRow = IMPORT_START_ROW,
    startSheet = 1
  ) {
    super(startRow, startSheet, chooseProcessor)
  }
}
