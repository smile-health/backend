import BaseTemplate from "@smile-health/lib/excel/index.js"
import { MasterData } from "@smile-health/lib/types/param.js"
import path from "path"
import { MasterMaterialActivityData } from "./entity-material.schema.js"
import { FileResponse } from "@smile-health/lib/types/file.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"

export class EntityMaterialTemplate extends BaseTemplate {
  constructor(startRow = 10, startSheet = 1, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }

  async loadFile(fileName: string): Promise<void> {
    const templatePath = path.resolve(
      "public",
      "templates",
      "entity-material",
      fileName
    )
    return this.loadFromFile(templatePath)
  }

  async setEntities(rows: AsyncIterableIterator<MasterData>): Promise<void> {
    return this.addRows("ENTITY LIST", rows)
  }

  async setMaterials(
    rows: AsyncIterableIterator<MasterMaterialActivityData>
  ): Promise<void> {
    return this.addRows("MATERIAL ACTIVITY LIST", rows)
  }

  async generateTemplate(): Promise<FileResponse> {
    return {
      filename: this.title ?? "entity_material.xlsx",
      buffer: await this.processor.generate(),
    }
  }
}
