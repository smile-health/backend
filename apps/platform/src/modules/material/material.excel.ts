import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { MasterData } from "@smile/lib/types/param.js"
import path from "path"

export class MaterialLevel2TemplateV2 extends BaseTemplate {
  constructor(
    startRow = 12,
    startSheet = 1,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
  }

  async setActivities(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows("ACTIVITY LIST", rows)
  }

  async setManufactures(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows("MANUFACTURE LIST", rows)
  }

  async setMaterials(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows("MATERIAL LIST", rows)
  }

  async loadFile() {
    const templatePath = path.resolve(
      "public",
      "templates",
      "material",
      "material_level2_en.xlsx"
    )
    await this.loadFromFile(templatePath)
  }
}

export class MaterialLevel3TemplateV2 extends MaterialLevel2TemplateV2 {
  constructor() {
    super()
  }

  async loadFile() {
    const templatePath = path.resolve(
      "public",
      "templates",
      "material",
      "material_level3_en.xlsx"
    )
    await this.loadFromFile(templatePath)
  }
}
