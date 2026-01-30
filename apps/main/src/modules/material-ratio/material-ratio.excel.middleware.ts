import { ValidationError } from "@smile-health/lib/error.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import { Context } from "hono"
import { validator } from "hono/validator"
import z from "zod"
import {
  ImportRequestDTO,
  importSchema,
} from "./material-ratio.excel.schema.js"
import { MaterialRatioValidator } from "./material-ratio.validator.js"

export class MaterialRatioExcelMiddleware {
  constructor(private readonly validatorService: MaterialRatioValidator) {}

  async #getExcelRows(c: Context) {
    const startRow = 12
    const startSheet = 1

    const fileRequest = c.get("fileRequest")
    const template = new BaseTemplate(startRow, startSheet, PROCESSOR.SHEETJS)
    await template.loadFromBuffer(fileRequest["buffer"])
    const rows = template.getRows(c.var.t("common.data_entry"))
    const dataStartRow = template.getStartRow()

    return { rows, startRow: dataStartRow }
  }

  #getLabel(c: Context, path: string) {
    const fieldLabels: Record<string, string> = {
      from_material_id: "material_ratio.label.material_id",
      to_material_id: "material_ratio.label.material_id",
      from_subtype_id: "material_ratio.label.subtype_id",
      to_subtype_id: "material_ratio.label.subtype_id",
      from_material_qty: "material_ratio.label.ratio",
      to_material_qty: "material_ratio.label.ratio",
    }

    const dirLabels: Record<string, string> = {
      from_: "material_ratio.label.source_material",
      to_: "material_ratio.label.affected_material",
    }

    const baseKey = fieldLabels[path]
    const dirPrefix = Object.keys(dirLabels).find((p) => path.startsWith(p))
    const dirKey = dirPrefix ? dirLabels[dirPrefix] : null

    if (baseKey && dirKey) return `[${c.var.t(dirKey)} - ${c.var.t(baseKey)}]`
    if (baseKey) return `[${c.var.t(baseKey)}]`
    if (dirKey) return `[${c.var.t(dirKey)}]`
    return path ? `[${path}]` : ""
  }

  #parseRows(rows: unknown[], startRow: number, c: Context) {
    const parsedAtIndex: Array<ImportRequestDTO | null> = new Array(
      rows.length
    ).fill(null)

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as Record<string, unknown>
      const rowIdx = String(i + startRow)

      const values = Object.values(row)
      const [fromSubtype, fromMaterial, fromQty, toSubtype, toMaterial, toQty] =
        values

      const isEmptyRow = values.every((v) => v == null || v === "")
      if (isEmptyRow) {
        parsedAtIndex[i] = null
        continue
      }

      const dto = {
        from_subtype_id: fromSubtype,
        from_material_id: fromMaterial,
        from_material_qty: fromQty,
        to_subtype_id: toSubtype,
        to_material_id: toMaterial,
        to_material_qty: toQty,
      }

      const parsed = importSchema.safeParse(dto)
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          const key = String(issue.path[0] ?? "")
          const label = this.#getLabel(c, key)
          c.addError(rowIdx, issue.message, label)
        })
      }

      parsedAtIndex[i] = parsed.success ? parsed.data : (dto as never)
    }

    return parsedAtIndex
  }

  excel = validator("json", async (_val, c) => {
    const { rows, startRow } = await this.#getExcelRows(c)
    const parsedAtIndex = this.#parseRows(rows, startRow, c)

    const cache = {
      relations: new Map<string, z.ZodIssue[]>(),
    }

    for (let idx = 0; idx < parsedAtIndex.length; idx++) {
      const rowIdx = String(idx + startRow)
      const data = parsedAtIndex[idx]

      if (!data) continue

      const cacheKey = [
        data.from_subtype_id,
        data.from_material_id,
        data.to_subtype_id,
        data.to_material_id,
      ].join(":")

      let issues = cache.relations.get(cacheKey)
      if (!issues) {
        issues = await this.validatorService.validateRelations(c, {
          from_subtype_id: data.from_subtype_id,
          from_material_id: data.from_material_id,
          to_subtype_id: data.to_subtype_id,
          to_material_id: data.to_material_id,
        })
        cache.relations.set(cacheKey, issues)
      }

      for (const issue of issues) {
        const key = String(issue.path[0] ?? "")
        const label = this.#getLabel(c, key)
        c.addError(rowIdx, issue.message, label)
      }
    }

    if (c.var.errors) {
      throw new ValidationError()
    }

    const parsedRows = parsedAtIndex.filter(
      (r): r is ImportRequestDTO => r != null
    )

    return parsedRows
  })
}
