import { z } from "zod"
import { QueryParamsSchema } from "./query-param.schema.js"

/**
 * Base period schema for order-difference module
 * Properties: id, label, selector, week_number
 */
export const BasePeriodSchema = z.object({
  id: z.string(),
  label: z.string(),
  selector: z.string(),
  week_number: z.number().nullable(),
})

// Default export for backward compatibility
export const PeriodSchema = BasePeriodSchema

export type PeriodDTO = z.infer<typeof BasePeriodSchema>

/**
 * Query parameters schema for period-based operations
 * Intersects common QueryParamsSchema with period enum
 */
export const QueryParamsWithPeriodSchema = QueryParamsSchema.and(
  z.object({
    period: z.enum(["month", "day", "week"]).optional(),
  })
)

export type QueryParamsWithPeriod = z.infer<typeof QueryParamsWithPeriodSchema>
