import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import path from "node:path"
import { MasterData } from "@smile-health/lib/types/param.js"
export class AnnualPlanningMaterialSubstitutionExport extends BaseTemplate {
  constructor(
    startRow = 12,
    startSheet = 1,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
  }

  async loadFile(): Promise<void> {
    const templatePath = path.resolve(
      "public",
      "templates",
      "annual-planning-material-substitution",
      `material_substitution_template_${this.lang}.xlsx`
    )
    return this.loadFromFile(templatePath)
  }

  async setPlannedMaterialOptions(rows: AsyncIterableIterator<MasterData>) {
    return this.addRows(
      this.t("annual_planning_material_substitution.option.planned_materials"),
      rows
    )
  }

  async setMaterialSubstitutionOptions(
    rows: AsyncIterableIterator<MasterData>
  ) {
    return this.addRows(
      this.t(
        "annual_planning_material_substitution.option.material_substitutions"
      ),
      rows
    )
  }
}
