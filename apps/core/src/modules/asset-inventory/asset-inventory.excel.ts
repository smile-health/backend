import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import path from "path"

export class AssetInventoryExport extends BaseTemplate {
  constructor(startRow = 2, startSheet = 0, processor = PROCESSOR.XLSXPOPULATE) {
    super(startRow, startSheet, processor)
  }

  async setMasterData(rows: object[]) {
    return this.addRows(
      this.t("asset_inventory.export.sheet.master_data"),
      rows
    )
  }

  async setAssetInventoryData(rows: object[]) {
    return this.addRows(
      this.t("asset_inventory.export.sheet.asset_inventory_data"),
      rows
    )
  }

  async loadFile() {
    const templatePath = path.resolve(
      "public",
      "templates",
      "asset-inventory",
      `export_asset_inventory_${this.lang}.xlsx`
    )
    await this.loadFromFile(templatePath)
  }
}
