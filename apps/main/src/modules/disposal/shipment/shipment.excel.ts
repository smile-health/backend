import path from "path"
import { Context } from "hono"
import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"

export class ShipmentExport extends BaseTemplate {
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
export class DetailShipmentExport extends ShipmentExport {
  constructor() {
    super()
  }

  async loadFile(c: Context) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "disposal-shipment",
      `disposal_detail_${c.var.language}.xlsx`
    )

    await this.loadFromFile(templatePath)
  }
}