import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import path from "path"
import { MasterData } from "@smile/lib/types/param.js"

interface MasterDataTemperatureThreshold {
  id: number
  max_temperature: number | null
  min_temperature: number | null
}

export class AssetTypeTemplate extends BaseTemplate {
  constructor(
    startRow = 10,
    startSheet = 1,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
  }

  async setWorkspaces(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows(this.t("asset_type.sheet.workspace_list"), rows)
  }

  async setTemperatureThresholds(
    rows: AsyncIterableIterator<MasterDataTemperatureThreshold>
  ) {
    return this.addRows(
      this.t("asset_type.sheet.temperature_threshold_list"),
      rows
    )
  }

  async loadFile(fileName: string) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "asset-type",
      fileName
    )
    await this.loadFromFile(templatePath)
  }
}

export class AssetTypeExport extends BaseTemplate {
  constructor(startRow = 1, startSheet = 0, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }
}

export class AssetTypeImport extends BaseTemplate {
  constructor(startRow = 10, startSheet = 1, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }
}
