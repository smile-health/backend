import { z } from "zod"
import { materialIdQueryTransform } from "./material-ratio.schema.js"

/**
 * Coerces input to a positive finite number.
 */
const positiveNumber = z.coerce
  .number({
    error: (issue) =>
      issue.input === undefined ? undefined : "validator.number",
  })
  .refine((v) => Number.isFinite(v), {
    error: "validator.number",
  })
  .refine((v) => v > 0, {
    error: "validator.positive",
  })

/**
 * Import
 */
export const importSchema = z.object({
  from_subtype_id: positiveNumber,
  from_material_id: positiveNumber,
  from_material_qty: positiveNumber,
  to_subtype_id: positiveNumber,
  to_material_id: positiveNumber,
  to_material_qty: positiveNumber,
})
export type ImportRequestDTO = z.infer<typeof importSchema>

/**
 * Export Query
 */
export const exportQueriesSchema = z.object({
  material_id: materialIdQueryTransform,
})
export type ExportMaterialRatioQueries = z.infer<typeof exportQueriesSchema>
