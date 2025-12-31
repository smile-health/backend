import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { ValidationError } from "@smile/lib/error.js"
import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { Context } from "hono"
import { validator } from "hono/validator"
import { AnnualPlanningGroupTargetRepository } from "../annual-planning-group-target/annual-planning-group-target.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import {
  PopulationImportRequestDTO,
  PopulationImportSchema,
} from "./population.excel.schema.js"

const getNumOrZero = (v: unknown) =>
  v == null || v === "" ? 0 : Number(v as string | number)

const fmtLabel = (c: Context, key: string) => {
  const text = c.var.t(key)
  return text ? `[${text}]` : ""
}

export class PopulationExcelMiddleware {
  constructor(
    private readonly entityRepo: EntityRepository,
    private readonly annualPlanningRepo: AnnualPlanningGroupTargetRepository
  ) {}

  async #getExcelRows(c: Context) {
    const startRow = 10
    const startSheet = 1

    const fileRequest = c.get("fileRequest")
    const template = new BaseTemplate(startRow, startSheet, PROCESSOR.SHEETJS)
    await template.loadFromBuffer(fileRequest["buffer"])
    const rows = template.getRows(undefined, { blankrows: true, defval: true })
    const dataStartRow = template.getStartRow()

    return { rows, startRow: dataStartRow }
  }

  #parseRows(rows: unknown[], startRow: number, c: Context) {
    const parsedAtIndex: Array<PopulationImportRequestDTO | null> = Array(
      rows.length
    ).fill(null)

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>
      const rowIdx = String(i + startRow)
      const entityKey = c.var.t("common.entity_id")
      const itemKeys = Object.keys(row).filter((k) => k !== entityKey)

      const dto: PopulationImportRequestDTO = {
        entity_id: row[entityKey] as unknown as number,
        items: itemKeys.map((k) => ({
          target_group_title: String(k).trim(),
          population_number: getNumOrZero(row[k]),
        })),
      }

      const parsed = PopulationImportSchema.safeParse(dto)

      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          let key = String(issue.path[0] ?? "")

          if (key === "items" && issue.path.length >= 2) {
            const index = issue.path[1]
            if (typeof index === "number") {
              const colKey = itemKeys[index]
              if (colKey != null) {
                key = String(colKey).trim()
              }
            }
          }

          let label: string
          if (key === "entity_id") {
            label = fmtLabel(c, "common.entity_id")
          } else {
            label = key ? `[${key}]` : ""
          }

          c.addError(rowIdx, issue.message, label)
        })
      }

      // Always keep the row data, even when schema failed
      parsedAtIndex[i] = parsed.success ? parsed.data : dto
    }

    return parsedAtIndex
  }

  excel = validator("json", async (_val, c) => {
    const { rows, startRow } = await this.#getExcelRows(c)
    const parsedAtIndex = this.#parseRows(rows, startRow, c)

    const cache = {
      entity: new Map<number, boolean>(),
      targetGroup: new Map<string, boolean>(),
    }

    const existsEntity = async (id: number) => {
      if (cache.entity.has(id)) return cache.entity.get(id)!
      const row = await this.entityRepo.exists(c, id, ENTITY_TYPE.CITY)
      const ok = !!row
      cache.entity.set(id, ok)
      return ok
    }

    const existsTargetGroup = async (title: string) => {
      if (cache.targetGroup.has(title)) return cache.targetGroup.get(title)!
      const id = await this.annualPlanningRepo.existsByTitle(c, title)
      const ok = id != null
      cache.targetGroup.set(title, ok)
      return ok
    }

    for (let idx = 0; idx < rows.length; idx++) {
      const rowIdx = String(idx + startRow)
      const data = parsedAtIndex[idx]

      if (!data) continue

      const id = Number(data.entity_id)
      if (Number.isFinite(id) && id > 0) {
        const okEntity = await existsEntity(id)
        if (!okEntity) {
          c.addError(
            rowIdx,
            "validator.not_exist",
            fmtLabel(c, "common.entity_id")
          )
        }
      }

      for (const it of data.items) {
        if (!it.target_group_title) continue
        const ok = await existsTargetGroup(it.target_group_title)
        if (!ok)
          c.addError(
            rowIdx,
            "validator.not_exist",
            `[${it.target_group_title}]`
          )
      }
    }

    if (c.var.errors) {
      throw new ValidationError()
    }

    const parsedRows = parsedAtIndex as PopulationImportRequestDTO[]
    return parsedRows
  })
}
