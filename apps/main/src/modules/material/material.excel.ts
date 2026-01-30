import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import { MasterData } from "@smile-health/lib/types/param.js"
import path from "path"
import { ImportMaterialRequest } from "./material.schema.js"

export class MaterialLevel2TemplateV2 extends BaseTemplate {
  constructor(
    startRow = 12,
    startSheet = 1,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
  }

  async setActivities(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows(this.t("material.sheet.list_activity"), rows)
  }

  async setManufactures(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows(this.t("material.sheet.list_manufacture"), rows)
  }

  async setMaterials(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows(this.t("material.sheet.list_material"), rows)
  }

  public getRows(sheetName?: string): object[] {
    const rows = super.getRows(sheetName)

    return rows.map((r) => {
      const id = r[this.t("material.label.id")]
      const manufactures = r[this.t("material.label.manufacture")]
      const activities = r[this.t("material.label.activity")]
      const companions = r[this.t("material.label.material_companion")]
      const roles = r[this.t("material.label.addremove_role")]
      const entityTypes = r[this.t("material.label.addremove_entity_type")]

      return {
        id: id,
        material_companion: companions,
        manufactures: manufactures,
        activities: activities,
        is_addremove: roles && entityTypes ? 1 : 0,
        addremove: {
          entity_types: entityTypes,
          roles: roles,
        },
      }
    }) as ImportMaterialRequest
  }

  async loadFile() {
    const templatePath = path.resolve(
      "public",
      "templates",
      "material",
      `material_level2_${this.lang}.xlsx`
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
      `material_level3_${this.lang}.xlsx`
    )
    await this.loadFromFile(templatePath)
  }
}
