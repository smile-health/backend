import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { MasterData } from "@smile/lib/types/param"
import path from "path"

export class MaterialTemplate extends BaseTemplate {
  constructor(
    processor = PROCESSOR.XLSXPOPULATE,
    startRow = 10,
    startSheet = 1
  ) {
    super(startRow, startSheet, processor)
  }

  async setWorkspaces(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows("WORKSPACE LIST", rows)
  }

  async setConsumptionUnit(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows("UNIT CONSUMPTION LIST", rows)
  }

  async setDistributionUnit(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows("UNIT DISTRIBUTION LIST", rows)
  }

  async setMaterialType(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows("MATERIAL TYPE LIST", rows)
  }

  async loadTemplateFile(fileName: string) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "material",
      fileName
    )
    await this.loadFromFile(templatePath)
  }
}
