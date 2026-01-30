import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import { FileResponse } from "@smile-health/lib/types/file.js"
import { Context } from "hono"
import path from "path"
import { AnnualPlanningGroupTargetRepository } from "../annual-planning-group-target/annual-planning-group-target.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { LocationRepository } from "../location/location.repository.js"
import { UserRepository } from "../user/user.repository.js"
import { PopulationExcelRepository } from "./population.excel.repository.js"
import { PopulationImportRequestDTO } from "./population.excel.schema.js"

export class PopulationExcelModule {
  constructor(
    private readonly entityRepo: EntityRepository,
    private readonly annualPlanningRepo: AnnualPlanningGroupTargetRepository,
    private readonly repo: PopulationExcelRepository,
    private readonly userRepo: UserRepository,
    private readonly locationRepo: LocationRepository
  ) {}

  async getExcelTemplate(c: Context): Promise<FileResponse> {
    const language = c.var.language
    const filename = `population_${language}.xlsx`
    const templatePath = path.resolve(
      "public",
      "templates",
      "population",
      filename
    )

    const SHEET_DATA_INPUT = c.var.t("common.data_entry")
    const SHEET_ENTITY_DATA = c.var.t("common.entity")

    const excelTemplate = new BaseTemplate(2, 1, PROCESSOR.EXCELJS)
    await excelTemplate.loadFromFile(templatePath)

    const [entities, targetGroups] = await Promise.all([
      this.entityRepo.getActiveEntities(c),
      this.annualPlanningRepo.getActiveTargetGroups(c),
    ])

    const entityRows = entities.map((e) => ({ id: e.id, name: e.name }))
    await excelTemplate.addRows(SHEET_ENTITY_DATA, entityRows, 2, "A")

    const headerRow: Record<string, string> = {}
    const optionalRow: Record<string, string> = {}
    targetGroups.forEach((tg, i) => {
      headerRow[`c${i + 1}`] = tg.title
      optionalRow[`c${i + 1}`] = `(${c.var.t("common.optional")})`
    })
    await excelTemplate.addRows(SHEET_DATA_INPUT, [optionalRow], 8, "B")
    await excelTemplate.addRows(SHEET_DATA_INPUT, [headerRow], 9, "B")
    await excelTemplate.setRowAlignCenter(SHEET_DATA_INPUT, 8, "B")
    await excelTemplate.setRowAlignCenter(SHEET_DATA_INPUT, 9, "B")

    await excelTemplate.protectSheet(SHEET_ENTITY_DATA, "unsmile")
    await excelTemplate.setRowFontBold(SHEET_DATA_INPUT, 9, "B")
    await excelTemplate.autoFitColumns(SHEET_DATA_INPUT, 9, "B")

    return await excelTemplate.generate(
      `Template - ${c.var.t("common.import")} ${c.var.t("population.template.title")}`
    )
  }

  async import(c: Context, year: number, rows: PopulationImportRequestDTO[]) {
    const summary = {
      total: rows.length,
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; message: string }>,
    }

    const cache = new Map<string, number>()

    const existsIn = async (title: string) => {
      if (cache.has(title)) return cache.get(title)!

      const id = await this.annualPlanningRepo.existsByTitle(c, title)
      if (id != null) cache.set(title, id)

      return id
    }

    for (const [i, row] of rows.entries()) {
      const rowIndex = i + 1
      const entity_id = Number(row.entity_id)

      try {
        const entity = await this.entityRepo.findBasicById(c, entity_id)

        for (const item of row.items) {
          const target_group_id = await existsIn(item.target_group_title)

          await this.repo.createOrUpdatePopulation(c, {
            year,
            entity_id,
            province_id: Number(entity?.province_id ?? 0),
            target_group_id: Number(target_group_id ?? 0),
            population_number: Number(item.population_number ?? 0),
            user_id: c.var.user.id,
          })
        }

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
    params: { year: number; province_id: number }
  ): Promise<FileResponse> {
    const title = c.var.t("population.template.title")
    const timezone = c.req.header("Timezone")

    const excelTemplate = new BaseTemplate()
    await excelTemplate.initSheet(title)
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)
    excelTemplate.setLanguage(c.var.language)

    const [targetGroups, rows, provinceRow] = await Promise.all([
      this.annualPlanningRepo.getActiveTargetGroups(c),
      this.repo.getExportRows(c, {
        year: params.year,
        province_id: params.province_id,
      }),
      this.locationRepo.findByID(c, params.province_id),
    ])

    if (!targetGroups.length || !rows.length) {
      return await excelTemplate.generate()
    }

    const updatedByIds = Array.from(
      new Set(
        (rows as Array<{ updated_by: number | null }>)
          .map((r) => r.updated_by)
          .filter((id): id is number => id != null)
      )
    )

    const usersMap: Record<
      number,
      { firstname?: string | null; fullname?: string | null }
    > =
      updatedByIds.length > 0
        ? await this.userRepo.getBasicDetailMapped(c, updatedByIds)
        : {}

    const columns = [
      {
        header: c.var.t("population.export.city_or_district"),
        width: 30,
      },
      ...targetGroups.map((tg) => ({
        header: tg.title,
        width: 20,
      })),
      {
        header: c.var.t("common.updated_by"),
        width: 20,
      },
    ]

    excelTemplate.setColumns(columns, "A1", title)

    const mapped = new Map<
      number,
      {
        entity_name: string
        updated_by: number | null
        values: Record<number, number>
      }
    >()

    const totalByTargetGroup = new Map<number, number>()

    for (const row of rows as Array<{
      entity_id: number
      entity_name: string
      target_group_id: number
      population_number: number
      updated_by: number | null
    }>) {
      let item = mapped.get(row.entity_id)
      if (!item) {
        item = {
          entity_name: row.entity_name,
          updated_by: row.updated_by,
          values: {},
        }
        mapped.set(row.entity_id, item)
      }

      item.values[row.target_group_id] = Number(row.population_number ?? 0)
      const currentTotal = totalByTargetGroup.get(row.target_group_id) ?? 0
      totalByTargetGroup.set(
        row.target_group_id,
        currentTotal + Number(row.population_number ?? 0)
      )
      if (row.updated_by != null) {
        item.updated_by = row.updated_by
      }
    }

    const excelRows: Array<Record<string, unknown>> = []

    const provinceName = (provinceRow as { name?: string } | undefined)?.name

    const summaryRowValues: Array<string | number | null> = []
    summaryRowValues.push(provinceName ?? "")

    for (const tg of targetGroups) {
      summaryRowValues.push(totalByTargetGroup.get(tg.id) ?? 0)
    }

    summaryRowValues.push("")

    excelRows.push(summaryRowValues as unknown as Record<string, unknown>)

    for (const item of mapped.values()) {
      const rowValues: Array<string | number | null> = []

      rowValues.push(item.entity_name)

      for (const tg of targetGroups) {
        rowValues.push(item.values[tg.id] ?? 0)
      }

      const updatedByName =
        item.updated_by != null
          ? (usersMap[item.updated_by!]?.firstname ?? "")
          : ""

      rowValues.push(updatedByName)

      excelRows.push(rowValues as unknown as Record<string, unknown>)
    }

    await excelTemplate.addRows(title, excelRows, 2, "A")

    return await excelTemplate.generate()
  }
}
