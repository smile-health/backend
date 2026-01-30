import { IdSchema } from "@smile-health/lib/types/param.js"
import z from "zod"

/**
 * Coerces input to a positive finite number.
 */
const positiveNumber = z.coerce
  .number({ invalid_type_error: "validator.number" })
  .refine((v) => Number.isFinite(v), { message: "validator.number" })
  .refine((v) => v > 0, { message: "validator.positive" })

/**
 * Coverage value from Excel. Blank -> 0, negative/invalid -> validation error.
 */
const coverageNumberSchema = z.any().transform((v, ctx) => {
  if (v == null || v === "") return 0

  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
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
      .string({ invalid_type_error: "validator.string" })
      .min(1, { message: "validator.required" })
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
            code: z.ZodIssueCode.custom,
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
          .string({ invalid_type_error: "validator.string" })
          .min(1, { message: "validator.required" }),
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
