import { IdSchema } from "@smile-health/lib/types/param.js"
import { z } from "zod"

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
 * Coverage value from Excel. Blank -> 0, negative/invalid -> validation error.
 */
// zod 4: z.any().transform() menjadikan key wajib; .optional() menjaga kolom kosong tetap jadi 0.
const coverageNumberSchema = z
  .any()
  .optional()
  .transform((v, ctx) => {
    if (v == null || v === "") return 0

    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({
        code: "custom",
        message: "validator.number",
      })
      return z.NEVER
    }

    return n
  })

/**
 * Import Param
 */
export const importParamsSchema = z.object({
  programPlanId: IdSchema,
})
export type ImportParams = z.infer<typeof importParamsSchema>

/**
 * Import
 */
export const importSchema = z.object({
  material_id: positiveNumber,
  activity_id: positiveNumber,
  ip: positiveNumber,
  month_distribution: z.preprocess(
    (v) => {
      if (v == null) return ""
      if (typeof v === "string") return v.trim()
      if (typeof v === "number" && Number.isFinite(v) && !Number.isInteger(v)) {
        return String(v).replace(".", ",").trim()
      }
      return String(v).trim()
    },
    z
      .string({
        error: (issue) =>
          issue.input === undefined ? undefined : "validator.string",
      })
      .min(1, {
        error: "validator.required",
      })
      .superRefine((raw, ctx) => {
        let months: number[] = []

        try {
          const parsed = JSON.parse(raw)
          const values = Array.isArray(parsed) ? parsed : [parsed]
          months = values
            .map(Number)
            .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
        } catch {
          months = raw
            .split(",")
            .map((v) => Number(v.trim()))
            .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
        }

        if (!months.length) {
          ctx.addIssue({
            code: "custom",
            message: "validator.number",
          })
        }
      })
  ),
  target_group_id: positiveNumber,
  number_of_dose: positiveNumber,
  coverages: z
    .array(
      z.object({
        province_name: z
          .string({
            error: (issue) =>
              issue.input === undefined ? undefined : "validator.string",
          })
          .min(1, {
            error: "validator.required",
          }),
        coverage_number: coverageNumberSchema,
      })
    )
    .optional(),
})
export type ImportRow = z.infer<typeof importSchema>

/**
 * Export Query
 */
export const exportQueriesSchema = z.object({
  material_id: z.coerce.number().optional(),
  activity_id: z.coerce.number().optional(),
})
export type ExportQueries = z.infer<typeof exportQueriesSchema>
