import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"

export class AssetInventoryExport extends BaseTemplate {
  constructor(startRow = 1, startSheet = 0, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }
}
