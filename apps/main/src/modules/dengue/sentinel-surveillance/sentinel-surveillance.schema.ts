import { z } from "zod"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"

const preprocessNumber = (value: unknown) => {
  if (value === null || value === "") return undefined
  if (typeof value === "string") return parseInt(value, 10)
  if (typeof value === "number") return value
  return undefined
}

const PositiveIntSchema = z.number().int().positive()

export const GetPatientsQuerySchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
  nik: z.string().min(16).max(16, "NIK must be exactly 16 characters").optional(),
})

export const ValidateNikParamSchema = z.object({
  nik: z.string().min(16).max(16, "NIK must be exactly 16 characters"),
})

export const GetSpecimensQuerySchema = PaginationQueriesSchema.extend({
  nik: z.union([
    z.string(),
    z.array(z.string())
  ]).optional().transform((val) => {
    if (!val) return undefined

    // If it's already an array, join and split to handle both formats
    const str = Array.isArray(val) ? val.join(',') : val

    // Split by comma and trim whitespace
    const niks = str.split(',').map(n => n.trim()).filter(n => n.length > 0)

    // Validate each NIK is exactly 16 characters
    for (const nik of niks) {
      if (nik.length !== 16 || !/^\d+$/.test(nik)) {
        throw new Error(`Invalid NIK: ${nik}. NIK must be exactly 16 digits`)
      }
    }

    return niks.length > 0 ? niks : undefined
  }),
  specimen_id: z.union([
    z.string(),
    z.array(z.string())
  ]).optional().transform((val) => {
    if (!val) return undefined

    // If it's already an array, join and split to handle both formats
    const str = Array.isArray(val) ? val.join(',') : val

    // Split by comma and trim whitespace, then convert to numbers
    const ids = str.split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)
      .map(id => {
        const num = parseInt(id, 10)
        if (isNaN(num) || num <= 0) {
          throw new Error(`Invalid specimen_id: ${id}. Must be a positive integer`)
        }
        return num
      })

    return ids.length > 0 ? ids : undefined
  }),
})

export const GetSentinelSurveillanceRequestSchema = PaginationQueriesSchema.extend({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  specimen_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
})

export const GetSentinelSurveillanceIndexSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 1)),
  paginate: z
    .string()
    .optional()
    .transform((val) => (val ? Number(val) : 50)),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export const CreateSentinelSurveillanceSchema = z.object({
  patient_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  specimen_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  duration: z.preprocess(preprocessNumber, PositiveIntSchema),
  case_report_completed: z.boolean().default(false),
  lab_result_id: z.number(),
})

export const UpdateSentinelSurveillanceSchema = z.object({
  patient_id: z.preprocess(preprocessNumber, PositiveIntSchema),
  specimen_id: z.preprocess(preprocessNumber, PositiveIntSchema).optional().nullable(),
  duration: z.preprocess(preprocessNumber, PositiveIntSchema).optional(),
  case_report_completed: z.boolean().optional(),
  lab_result_id: z.number().optional(),
})

export const ValidateIdParamSchema = z.object({
  id: z.preprocess(preprocessNumber, PositiveIntSchema),
})

export const sentinelSurveillanceId = z.object({ id: z.string() })

export type GetPatientsQuery = z.infer<typeof GetPatientsQuerySchema>
export type ValidateNikParam = z.infer<typeof ValidateNikParamSchema>
export type GetSpecimensQuery = z.infer<typeof GetSpecimensQuerySchema>
export type GetSentinelSurveillanceRequest = z.infer<typeof GetSentinelSurveillanceRequestSchema>
export type GetSentinelSurveillanceIndex = z.infer<typeof GetSentinelSurveillanceIndexSchema>
export type CreateSentinelSurveillanceRequest = z.infer<typeof CreateSentinelSurveillanceSchema>
export type UpdateSentinelSurveillanceRequest = z.infer<typeof UpdateSentinelSurveillanceSchema>
export type ValidateIdParam = z.infer<typeof ValidateIdParamSchema>