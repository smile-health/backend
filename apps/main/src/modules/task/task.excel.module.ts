import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { generateEventCode } from "@smile/lib/utils.js"
import { Context } from "hono"
import path from "node:path"
import { ActivityRepository } from "../activity/activity.repository.js"
import { AnnualPlanningProgramPlanRepository } from "../annual-planning-program-plan/annual-planning-program-plan.repository.js"
import { LocationRepository } from "../location/location.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { GetMaterialsQueries } from "../material/material.schema.js"
import { TargetGroupRepository } from "../target-group/target-group.repository.js"
import { UserBasicInfoMap } from "../user/user.mapper.js"
import { UserRepository } from "../user/user.repository.js"
import { ExportRow, TaskExcelRepository } from "./task.excel.repository.js"
import { ExportQueries, ImportRow } from "./task.excel.schema.js"
import { formatMonthDistribution } from "./task.mapper.js"

const SHEET_PROTECTION_PASSWORD = "unsmile"

const EVENT_CODE_CONFIG = {
  length: 10,
  includeUppercase: true,
  includeLowercase: false,
  includeNumbers: true,
} as const

type TaskEntry = {
  base: ExportRow
  coverages: (number | null)[]
}

function buildTaskMap(
  rows: ExportRow[],
  provinceCount: number,
  provinceIndexById: Map<number, number>
) {
  const taskMap = new Map<number, TaskEntry>()

  for (const row of rows) {
    let entry = taskMap.get(row.task_id)
    if (!entry) {
      entry = { base: row, coverages: new Array(provinceCount).fill(null) }
      taskMap.set(row.task_id, entry)
    }

    if (row.province_id == null || row.coverage_number == null) continue

    const idx = provinceIndexById.get(Number(row.province_id))
    if (idx == null) continue

    const n = Number(row.coverage_number)
    if (Number.isFinite(n) && n > 0) {
      entry.coverages[idx] = n
    }
  }

  return taskMap
}

function buildDataRows(
  taskMap: Map<number, TaskEntry>,
  userMap: UserBasicInfoMap,
  language: string | undefined
) {
  const dataRows: unknown[][] = []

  for (const { base, coverages } of taskMap.values()) {
    const monthText = formatMonthDistribution(
      base.month_distribution,
      language
    ).join(", ")
    const user =
      base.updated_by == null ? null : (userMap[base.updated_by] ?? null)
    const updatedByName = user?.firstname ?? user?.fullname ?? ""

    dataRows.push([
      base.code,
      base.material_name ?? "",
      base.activity_name ?? "",
      monthText,
      base.ip,
      base.target_group_name ?? "",
      Number(base.number_of_dose ?? 0),
      updatedByName,
      ...coverages,
    ])
  }

  return dataRows
}

export class TaskExcelModule {
  constructor(
    private readonly programPlanRepo: AnnualPlanningProgramPlanRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly targetGroupRepo: TargetGroupRepository,
    private readonly locationRepo: LocationRepository,
    private readonly taskExcelRepo: TaskExcelRepository,
    private readonly userRepo: UserRepository
  ) {}

  async getExcelTemplate(c: Context) {
    const language = c.var.language
    const filename = `task_${language}.xlsx`
    const templatePath = path.resolve("public", "templates", "task", filename)

    const SHEET_PROGRAM_PLAN_DATA = c.var.t("common.program_plan")
    const SHEET_MATERIAL_DATA = c.var.t("common.material")
    const SHEET_ACTIVITY_DATA = c.var.t("common.activity")
    const SHEET_TARGET_GROUP_DATA = c.var.t("common.target_group")
    const SHEET_DATA_INPUT = c.var.t("common.data_entry")

    const excelTemplate = new BaseTemplate(2, 1, PROCESSOR.EXCELJS)
    excelTemplate.setTitle(c.var.t("task.template.title"))
    await excelTemplate.loadFromFile(templatePath)

    const materialParams = {} as GetMaterialsQueries

    const [
      programPlanStream,
      materialStream,
      activityStream,
      targetGroupStream,
      locationStream,
    ] = await Promise.all([
      this.programPlanRepo.getStreamData(c),
      this.materialRepo.getStreamData(c, materialParams),
      this.activityRepo.getStreamData(c),
      this.targetGroupRepo.getStreamData(c),
      this.locationRepo.getLocationByLevelStreamData(c, 0),
    ])

    await excelTemplate.addRows(
      SHEET_PROGRAM_PLAN_DATA,
      programPlanStream,
      2,
      "A"
    )
    await excelTemplate.addRows(SHEET_MATERIAL_DATA, materialStream, 2, "A")
    await excelTemplate.addRows(SHEET_ACTIVITY_DATA, activityStream, 2, "A")
    await excelTemplate.addRows(
      SHEET_TARGET_GROUP_DATA,
      targetGroupStream,
      2,
      "A"
    )

    await excelTemplate.protectSheet(
      SHEET_PROGRAM_PLAN_DATA,
      SHEET_PROTECTION_PASSWORD
    )
    await excelTemplate.protectSheet(
      SHEET_MATERIAL_DATA,
      SHEET_PROTECTION_PASSWORD
    )
    await excelTemplate.protectSheet(
      SHEET_ACTIVITY_DATA,
      SHEET_PROTECTION_PASSWORD
    )
    await excelTemplate.protectSheet(
      SHEET_TARGET_GROUP_DATA,
      SHEET_PROTECTION_PASSWORD
    )

    const headerRow: Record<string, string> = {}
    const optionalRow: Record<string, string> = {}
    let index = 0

    for await (const row of locationStream as AsyncIterableIterator<{
      id: number
      name: string
    }>) {
      index += 1
      headerRow[`c${index}`] = row.name
      optionalRow[`c${index}`] = `(${c.var.t("common.optional")})`
    }

    if (index > 0) {
      await excelTemplate.addRows(SHEET_DATA_INPUT, [optionalRow], 8, "G")
      await excelTemplate.addRows(SHEET_DATA_INPUT, [headerRow], 9, "G")
      await excelTemplate.setRowAlignCenter(SHEET_DATA_INPUT, 8, "G")
      await excelTemplate.setRowAlignCenter(SHEET_DATA_INPUT, 9, "G")
      await excelTemplate.autoFitColumns(SHEET_DATA_INPUT, 9, "G")
    }

    return await excelTemplate.generate(
      `Template - ${c.var.t("common.import")} ${c.var.t("task.template.title")}`
    )
  }

  async import(c: Context, programPlanId: number, rows: ImportRow[]) {
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

    const provinces = await this.locationRepo.getLocations(c, 0)
    const provinceMap = new Map<string, number>()
    provinces.forEach((p) => {
      if (p.name) {
        provinceMap.set(String(p.name).trim(), Number(p.id))
      }
    })

    for (const [i, row] of rows.entries()) {
      const rowIndex = i + 1

      try {
        const coverages = (row.coverages ?? [])
          .map((cov) => {
            const provinceId = provinceMap.get(cov.province_name.trim())
            if (!provinceId) {
              return null
            }

            const coverageNumber = Number(cov.coverage_number ?? 0)
            if (!Number.isFinite(coverageNumber) || coverageNumber <= 0) {
              return null
            }

            return {
              province_id: provinceId,
              coverage_number: coverageNumber,
            }
          })
          .filter(
            (v): v is { province_id: number; coverage_number: number } =>
              v != null
          )

        const code = await generateEventCode(EVENT_CODE_CONFIG)
        const monthDistribution = row.month_distribution
          .trim()
          .replace(/,+\s*$/, "")

        await this.taskExcelRepo.upsertTask(c, {
          program_plan_id: programPlanId,
          material_id: row.material_id,
          activity_id: row.activity_id,
          ip: row.ip,
          month_distribution: monthDistribution,
          target_group_id: row.target_group_id,
          number_of_dose: row.number_of_dose,
          coverages,
          code,
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

  async export(c: Context, programPlanId: number, queries: ExportQueries) {
    const t = c.var.t

    const programPlans = await this.programPlanRepo.getProgramPlanMapped(c, [
      programPlanId,
    ])
    const plan = programPlans[programPlanId]

    const sheetName = t("task.template.title")
    const year = plan?.year

    const headerTitle = `${t("task.label.program_plan")} ${year ?? ""}`
    const excelTemplate = new BaseTemplate(2, 1, PROCESSOR.EXCELJS)
    await excelTemplate.initSheet(sheetName)
    excelTemplate.setTitle(year ? `${sheetName} ${year}` : sheetName)
    excelTemplate.setLanguage(c.var.language)
    excelTemplate.setTimezone(c.req.header("Timezone"))

    const provinces = await this.locationRepo.getLocations(c, 0)

    const headerRow1 = [
      headerTitle,
      null,
      null,
      null,
      null,
      null,
      ...new Array(provinces.length).fill(null),
    ]

    const headerRow2 = [
      t("task.label.task_id"),
      t("task.label.material"),
      t("task.label.activity"),
      t("task.label.month_distribution"),
      t("task.label.ip"),
      t("task.label.target_group"),
      t("task.label.number_of_dose"),
      t("common.updated_by"),
      ...provinces.map((p) => p.name ?? ""),
    ]

    const columnConfigs = Array.from(
      { length: 6 + provinces.length },
      (_, idx) => ({
        header: "",
        width: idx < 6 ? 20 : 15,
      })
    )

    excelTemplate.setColumns(columnConfigs, "A1", sheetName)
    await excelTemplate.addRows(sheetName, [headerRow1, headerRow2], 1, "A")
    excelTemplate.mergeCells(sheetName, "A1", "F1", true)
    await excelTemplate.setRowFontBold(sheetName, 1, "A")
    await excelTemplate.setRowFontBold(sheetName, 2, "A")

    const rows = await this.taskExcelRepo.getExportRows(c, {
      programPlanId,
      materialId: queries.material_id,
      activityId: queries.activity_id,
    })

    const userIds = [
      ...new Set(
        rows.map((r) => r.updated_by).filter((id): id is number => id != null)
      ),
    ]
    const userMap = userIds.length
      ? await this.userRepo.getBasicDetailMapped(c, userIds)
      : {}

    const provinceIndexById = new Map<number, number>()
    for (const [idx, p] of provinces.entries()) {
      if (p.id != null) provinceIndexById.set(Number(p.id), idx)
    }

    const taskMap = buildTaskMap(rows, provinces.length, provinceIndexById)
    const dataRows = buildDataRows(taskMap, userMap, c.var.language)

    if (dataRows.length > 0) {
      await excelTemplate.addRows(sheetName, dataRows, 3, "A")
    }

    return await excelTemplate.generate()
  }
}
