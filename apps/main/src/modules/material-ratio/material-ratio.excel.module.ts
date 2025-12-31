import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { Context } from "hono"
import path from "node:path"
import { MaterialSubtypeRepository } from "../material-subtype/material-subtype.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { GetMaterialsQueries } from "../material/material.schema.js"
import { UserRepository } from "../user/user.repository.js"
import { MaterialRatioExcelRepository } from "./material-ratio.excel.repository.js"
import {
  ExportMaterialRatioQueries,
  ImportRequestDTO,
} from "./material-ratio.excel.schema.js"
import { toExport } from "./material-ratio.mapper.js"
import { AnnualPlanningProgramPlanRepository } from "../annual-planning-program-plan/annual-planning-program-plan.repository.js"

const SHEET_PROTECTION_PASSWORD = "unsmile"

export class MaterialRatioExcelModule {
  constructor(
    private readonly materialSubtypeRepo: MaterialSubtypeRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly repo: MaterialRatioExcelRepository,
    private readonly userRepo: UserRepository,
    private readonly programPlanRepo: AnnualPlanningProgramPlanRepository
  ) {}

  async getExcelTemplate(c: Context) {
    const language = c.var.language
    const filename = `material-ratio_${language}.xlsx`
    const templatePath = path.resolve(
      "public",
      "templates",
      "material-ratio",
      filename
    )

    const SHEET_SUBTYPE_DATA = c.var.t("common.subtype")
    const SHEET_MATERIAL_DATA = c.var.t("common.material")

    const excelTemplate = new BaseTemplate(2, 1, PROCESSOR.EXCELJS)
    excelTemplate.setTitle(c.var.t("material_ratio.template.title"))
    await excelTemplate.loadFromFile(templatePath)

    const materialParams = { material_level_id: 2 } as GetMaterialsQueries

    const [subtypeStream, materialStream] = await Promise.all([
      this.materialSubtypeRepo.getStreamData(c),
      this.materialRepo.getStreamData(c, materialParams),
    ])

    await excelTemplate.addRows(SHEET_SUBTYPE_DATA, subtypeStream, 2, "A")
    await excelTemplate.addRows(SHEET_MATERIAL_DATA, materialStream, 2, "A")

    await excelTemplate.protectSheet(
      SHEET_SUBTYPE_DATA,
      SHEET_PROTECTION_PASSWORD
    )
    await excelTemplate.protectSheet(
      SHEET_MATERIAL_DATA,
      SHEET_PROTECTION_PASSWORD
    )

    return await excelTemplate.generate(
      `Template - Import ${c.var.t("material_ratio.template.title")}`
    )
  }

  async import(c: Context, programPlanId: number, rows: ImportRequestDTO[]) {
    const userId = c.var.userId

    if (userId === undefined) {
      throw new Error("userId is required")
    }

    const summary = {
      total: rows.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; message: string }>,
    }

    for (const [i, row] of rows.entries()) {
      const rowIndex = i + 1

      try {
        await this.repo.upsertRatio(c, {
          program_plan_id: programPlanId,
          from_subtype_id: row.from_subtype_id,
          from_material_id: row.from_material_id,
          from_material_qty: row.from_material_qty,
          to_subtype_id: row.to_subtype_id,
          to_material_id: row.to_material_id,
          to_material_qty: row.to_material_qty,
          user_id: userId,
        })

        summary.success += 1
      } catch (e) {
        summary.failed += 1
        const msg = (e as Error)?.message || "failed"
        summary.errors.push({ row: rowIndex, message: msg })
      }
    }

    return summary
  }

  async export(
    c: Context,
    programPlanId: number,
    queries: ExportMaterialRatioQueries
  ) {
    const t = c.var.t
    const title = t("material_ratio.template.title")

    const programPlans = await this.programPlanRepo.getProgramPlanMapped(c, [
      programPlanId,
    ])
    const plan = programPlans[programPlanId]
    const year = plan?.year

    const excelTemplate = new BaseTemplate(2, 1, PROCESSOR.EXCELJS)
    await excelTemplate.initSheet(title)
    excelTemplate.setTitle(year ? `${title} ${year}` : title)
    excelTemplate.setLanguage(c.var.language)
    excelTemplate.setTimezone(c.req.header("Timezone"))

    const headerRows = [
      [
        t("material_ratio.label.source_material"),
        null,
        null,
        t("material_ratio.label.affected_material"),
        null,
        null,
        null,
      ],
      [
        t("material_ratio.label.subtype"),
        t("material_ratio.label.material"),
        t("material_ratio.label.ratio"),
        t("material_ratio.label.subtype"),
        t("material_ratio.label.material"),
        t("material_ratio.label.ratio"),
        t("common.updated_by"),
      ],
    ]

    excelTemplate.setColumns(
      [15, 25, 15, 15, 25, 15, 15].map((width) => ({ header: "", width })),
      "B1",
      title
    )

    await excelTemplate.addRows(title, headerRows, 1, "A")
    excelTemplate.mergeCells(title, "A1", "C1", true)
    excelTemplate.mergeCells(title, "D1", "F1", true)
    await excelTemplate.setRowFontBold(title, 1, "A")
    await excelTemplate.setRowFontBold(title, 2, "A")

    const rows = await this.repo.getExportRows(c, {
      programPlanId,
      materialIds: queries.material_id,
    })

    const userIds = [
      ...new Set(
        rows.map((r) => r.updated_by).filter((id): id is number => id != null)
      ),
    ]
    const userMap = userIds.length
      ? await this.userRepo.getBasicDetailMapped(c, userIds)
      : {}

    const dataRows = rows.map((row) => toExport(row, userMap))
    if (dataRows.length) {
      await excelTemplate.addRows(title, dataRows, 3, "A")
    }

    return await excelTemplate.generate()
  }
}
