import { ValidationError } from "@smile-health/lib/error.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import { Context } from "hono"
import { validator } from "hono/validator"
import { ActivityRepository } from "../activity/activity.repository.js"
import { AnnualPlanningProgramPlanRepository } from "../annual-planning-program-plan/annual-planning-program-plan.repository.js"
import { LocationRepository } from "../location/location.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { TargetGroupRepository } from "../target-group/target-group.repository.js"
import { ImportParams, ImportRow, importSchema } from "./task.excel.schema.js"

export class TaskExcelMiddleware {
  constructor(
    private readonly materialRepo: MaterialRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly programPlanRepo: AnnualPlanningProgramPlanRepository,
    private readonly targetGroupRepo: TargetGroupRepository,
    private readonly locationRepo: LocationRepository
  ) {}
  async #getExcelRows(c: Context) {
    const startRow = 10
    const startSheet = 1

    const fileRequest = c.get("fileRequest")
    const template = new BaseTemplate(startRow, startSheet, PROCESSOR.SHEETJS)
    await template.loadFromBuffer(fileRequest["buffer"])
    const SHEET_DATA_INPUT = c.var.t("common.data_entry")
    const rows = template.getRows(SHEET_DATA_INPUT, {
      blankrows: true,
      defval: true,
    })
    const dataStartRow = template.getStartRow()

    return { rows, startRow: dataStartRow }
  }

  #getLabel(c: Context, path: string) {
    const fieldLabels: Record<string, string> = {
      material_id: "task.label.material_id",
      activity_id: "task.label.activity_id",
      ip: "task.label.ip",
      month_distribution: "task.label.month_distribution",
      target_group_id: "task.label.target_group_id",
      number_of_dose: "task.label.number_of_dose",
      coverage_number: "task.label.coverage_number",
    }

    const baseKey = fieldLabels[path]

    if (baseKey) return `[${c.var.t(baseKey)}]`

    return path ? `[${path}]` : ""
  }

  #parseRows(rows: unknown[], startRow: number, c: Context) {
    const parsedAtIndex: Array<ImportRow | null> = new Array(rows.length).fill(
      null
    )

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>
      const rowIdx = String(i + startRow)

      const entries = Object.entries(row)
      if (!entries.length) {
        parsedAtIndex[i] = null
        continue
      }

      const baseEntries = entries.slice(0, 6)
      const baseValues = baseEntries.map(([, value]) => value)

      const isBaseEmpty = baseValues.every((v) => v == null || v === "")
      const hasCoverageValue = entries
        .slice(6)
        .some(([, v]) => v != null && v !== "")

      if (isBaseEmpty && !hasCoverageValue) {
        parsedAtIndex[i] = null
        continue
      }

      const [
        materialId,
        activityId,
        ip,
        monthDistribution,
        targetGroupId,
        dose,
      ] = baseValues

      const coverages = entries.slice(6).map(([provinceName, value]) => ({
        province_name: String(provinceName).trim(),
        coverage_number: value,
      }))

      const dto = {
        material_id: materialId,
        activity_id: activityId,
        ip,
        month_distribution: monthDistribution,
        target_group_id: targetGroupId,
        number_of_dose: dose,
        coverages,
      }

      const parsed = importSchema.safeParse(dto)
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          const key = String(
            [...issue.path].reverse().find((p) => typeof p === "string") ?? ""
          )
          const label = this.#getLabel(c, key)
          c.addError(rowIdx, issue.message, label)
        })
      }

      parsedAtIndex[i] = parsed.success ? parsed.data : (dto as never)
    }

    return parsedAtIndex
  }
  #collectReferenceIds(parsedAtIndex: Array<ImportRow | null>) {
    const materialIds = new Set<number>()
    const activityIds = new Set<number>()
    const targetGroupIds = new Set<number>()
    const provinceNames = new Set<string>()

    for (const row of parsedAtIndex) {
      if (!row) continue

      materialIds.add(row.material_id)
      activityIds.add(row.activity_id)
      targetGroupIds.add(row.target_group_id)

      for (const cov of row.coverages ?? []) {
        const n = Number(cov.coverage_number ?? 0)
        if (!Number.isFinite(n) || n <= 0) continue
        const name = cov.province_name?.trim()
        if (!name) continue
        provinceNames.add(name)
      }
    }

    return {
      materialIds,
      activityIds,
      targetGroupIds,
      provinceNames,
    }
  }

  #validateCoverageNumberRange(c: Context, row: ImportRow, rowIdx: string) {
    const min = 1
    const max = 100

    for (const cov of row.coverages ?? []) {
      const n = Number(cov.coverage_number ?? 0)
      if (!Number.isFinite(n) || n <= 0) continue

      if (!Number.isInteger(n)) {
        const name = cov.province_name?.trim()
        const label = name ? `[${name}]` : this.#getLabel(c, "coverage_number")
        c.addError(
          rowIdx,
          c.var.t("validator.integer", {
            field: name ? `[${name}]` : c.var.t("task.label.coverage_number"),
          }),
          label
        )
        continue
      }

      if (n < min || n > max) {
        const name = cov.province_name?.trim()
        const label = name ? `[${name}]` : this.#getLabel(c, "coverage_number")
        c.addError(
          rowIdx,
          c.var.t("validator.between", {
            field: name ? `[${name}]` : c.var.t("task.label.coverage_number"),
            condition: `${min} - ${max}`,
          }),
          label
        )
      }
    }
  }

  async #loadReferenceMaps(
    c: Context,
    programPlanId: number,
    startRow: number,
    materialIds: Set<number>,
    activityIds: Set<number>,
    targetGroupIds: Set<number>,
    provinceNames: Set<string>
  ) {
    const [planMap, materialMap, activityMap, targetGroupMap, locations] =
      await Promise.all([
        this.programPlanRepo.getProgramPlanMapped(c, [programPlanId]),
        materialIds.size
          ? this.materialRepo.getMaterialMapped(c, [...materialIds])
          : Promise.resolve({}),
        activityIds.size
          ? this.activityRepo.getActivityMapped(c, [...activityIds])
          : Promise.resolve({}),
        targetGroupIds.size
          ? this.targetGroupRepo.getTargetGroupMapped(c, [...targetGroupIds])
          : Promise.resolve({}),
        provinceNames.size
          ? this.locationRepo.getLocations(c, 0)
          : Promise.resolve([]),
      ])

    if (!planMap[programPlanId]) {
      c.addError(String(startRow), "validator.not_exist", "[program_plan_id]")
    }

    const provinceNameMap = new Map<string, number>()
    for (const loc of locations as Array<{
      id: number
      name: string | null
    }>) {
      if (!loc.name) continue
      provinceNameMap.set(String(loc.name).trim(), Number(loc.id))
    }

    return {
      materialMap,
      activityMap,
      targetGroupMap,
      provinceNameMap,
    }
  }

  #hasBaseValue(value: unknown) {
    return value != null && value !== ""
  }

  #hasBaseData(row: ImportRow) {
    return [
      row.material_id,
      row.activity_id,
      row.ip,
      row.month_distribution,
      row.target_group_id,
      row.number_of_dose,
    ].some((v) => this.#hasBaseValue(v))
  }

  #hasCoverageData(row: ImportRow) {
    return (row.coverages ?? []).some((cov) => {
      const n = Number(cov.coverage_number ?? 0)
      return Number.isFinite(n) && n > 0
    })
  }

  #validateBaseAndCoverage(c: Context, row: ImportRow, rowIdx: string) {
    const hasBaseData = this.#hasBaseData(row)
    const hasCoverageData = this.#hasCoverageData(row)

    if (hasBaseData && !hasCoverageData) {
      c.addError(
        rowIdx,
        "validator.required",
        this.#getLabel(c, "coverage_number")
      )
    }
  }

  #validateReferenceExistence(
    c: Context,
    row: ImportRow,
    rowIdx: string,
    materialMap: Record<number, unknown>,
    activityMap: Record<number, unknown>,
    targetGroupMap: Record<number, unknown>
  ) {
    if (!materialMap[row.material_id]) {
      c.addError(
        rowIdx,
        "validator.not_exist",
        this.#getLabel(c, "material_id")
      )
    }

    if (!activityMap[row.activity_id]) {
      c.addError(
        rowIdx,
        "validator.not_exist",
        this.#getLabel(c, "activity_id")
      )
    }

    if (!targetGroupMap[row.target_group_id]) {
      c.addError(
        rowIdx,
        "validator.not_exist",
        this.#getLabel(c, "target_group_id")
      )
    }
  }

  #validateProvinceCoverage(
    c: Context,
    row: ImportRow,
    rowIdx: string,
    provinceNameMap: Map<string, number>
  ) {
    for (const cov of row.coverages ?? []) {
      const n = Number(cov.coverage_number ?? 0)
      if (!Number.isFinite(n) || n <= 0) continue

      const name = cov.province_name?.trim()
      if (!name) continue

      if (!provinceNameMap.get(name)) {
        c.addError(rowIdx, "validator.not_exist", `[${name}]`)
      }
    }
  }

  #validateMonthlyDistribution(
    c: Context,
    startRow: number,
    parsedAtIndex: Array<ImportRow | null>
  ) {
    parsedAtIndex.forEach((row, index) => {
      if (row === null) return
      const months = row.month_distribution.split(",").map(Number)
      const invalid = months.filter((m) => m < 1 || m > 12)
      const duplicates = months.filter((m, i) => months.indexOf(m) !== i)
      const rowIdx = String(index + startRow)

      if (invalid.length > 0) {
        c.addError(rowIdx, "validator.invalid_month_import_task")
      }

      if (duplicates.length > 0) {
        c.addError(rowIdx, "validator.duplicated_month_import_task")
      }
    })
  }

  #validateParsedRows(
    c: Context,
    startRow: number,
    parsedAtIndex: Array<ImportRow | null>,
    materialMap: Record<number, unknown>,
    activityMap: Record<number, unknown>,
    targetGroupMap: Record<number, unknown>,
    provinceNameMap: Map<string, number>
  ) {
    parsedAtIndex.forEach((row, idx) => {
      if (!row) return
      const rowIdx = String(idx + startRow)

      this.#validateBaseAndCoverage(c, row, rowIdx)
      this.#validateCoverageNumberRange(c, row, rowIdx)
      this.#validateReferenceExistence(
        c,
        row,
        rowIdx,
        materialMap,
        activityMap,
        targetGroupMap
      )
      this.#validateProvinceCoverage(c, row, rowIdx, provinceNameMap)
    })
  }

  excel = validator("json", async (_val, c) => {
    const { rows, startRow } = await this.#getExcelRows(c)
    const parsedAtIndex = this.#parseRows(rows, startRow, c)

    const reqParam = c.req as {
      valid: (type: "param") => ImportParams
    }
    const { programPlanId } = reqParam.valid("param")

    const { materialIds, activityIds, targetGroupIds, provinceNames } =
      this.#collectReferenceIds(parsedAtIndex)

    this.#validateMonthlyDistribution(c, startRow, parsedAtIndex)
    if (parsedAtIndex.some((r) => r != null)) {
      const { materialMap, activityMap, targetGroupMap, provinceNameMap } =
        await this.#loadReferenceMaps(
          c,
          programPlanId,
          startRow,
          materialIds,
          activityIds,
          targetGroupIds,
          provinceNames
        )

      this.#validateParsedRows(
        c,
        startRow,
        parsedAtIndex,
        materialMap,
        activityMap,
        targetGroupMap,
        provinceNameMap
      )
    }

    if (c.var.errors) {
      throw new ValidationError()
    }

    const parsedRows = parsedAtIndex.filter((r): r is ImportRow => r != null)

    return parsedRows
  })
}
