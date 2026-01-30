import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import path from "path"
import { MasterData } from "@smile-health/lib/types/param.js"

export class AssetModelTemplate extends BaseTemplate {
  constructor(
    startRow = 10,
    startSheet = 1,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
  }

  async setManufactures(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows(this.t("asset_model.sheet.manufacture_list"), rows)
  }

  async setAssetTypes(
    rows: AsyncIterableIterator<{
      id: number
      name: string
      thresholds: string
    }>
  ) {
    const rowsWithThresholds: (string | number | Date | null | undefined)[][] =
      []
    for await (const row of rows) {
      const item = [row.id, row.name, row.thresholds]

      rowsWithThresholds.push(item)
    }

    return this.addRows(
      this.t("asset_model.sheet.asset_type_list"),
      rowsWithThresholds
    )
  }

  async setWorkspaces(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows(this.t("asset_model.sheet.workspace_list"), rows)
  }

  async setPqsCodes(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows(this.t("asset_model.sheet.pqs_code_list"), rows)
  }

  async loadFile(fileName: string) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "asset-model",
      fileName
    )
    await this.loadFromFile(templatePath)
  }
}

export class AssetModelExport extends BaseTemplate {
  constructor(startRow = 1, startSheet = 0, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }
}

export class AssetModelImport extends BaseTemplate {
  constructor(startRow = 10, startSheet = 1, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }
}
