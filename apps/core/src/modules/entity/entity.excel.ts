import { FileResponse } from "@smile-health/lib/types/file.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import path from "path"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"

export class EntityTemplate extends BaseTemplate {
  constructor(startRow = 10, startSheet = 1, processor = PROCESSOR.SHEETJS) {
    super(startRow, startSheet, processor)
  }

  async loadFile(fileName: string): Promise<void> {
    const templatePath = path.resolve("public", "templates", "entity", fileName)
    return this.loadFromFile(templatePath)
  }

  async generateTemplate(): Promise<FileResponse> {
    return {
      filename: this.title ?? "entity.xlsx",
      buffer: await this.processor.generate(),
    }
  }
}
