import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import z from "zod"

/** Reusable coverage entry schema */
const coverageEntrySchema = z.object({
  province_id: z.number(),
  coverage_number: z.number(),
})

/** Reusable coverages array schema (min 1) */
const coveragesSchema = z.array(coverageEntrySchema).min(1)

/**
 * Create & Update
 */
export const taskItemSchema = z.object({
  program_plan_id: z.number(),
  material_id: z.number(),
  activity_id: z.number(),
  ip: z.number(),
  month_distribution: z.string(),
  target_group_id: z.number(),
  number_of_dose: z.number(),
  coverages: coveragesSchema,
})
export type TaskItem = z.infer<typeof taskItemSchema>

/**
 * Create
 */
export const createSchema = z.object({
  program_plan_id: z.number(),
  material_id: z.number(),
  activity_id: z.number(),
  month_distribution: z.string(),
  target_groups: z
    .array(
      z.object({
        target_group_id: z.number(),
        ip: z.number(),
        number_of_dose: z.number(),
        coverages: coveragesSchema,
      })
    )
    .min(1),
})
export type CreateInput = z.infer<typeof createSchema>

/**
 * Update
 */
export const updateSchema = z.object({
  month_distribution: z.string(),
  target_groups: z
    .array(
      z.object({
        ip: z.number(),
        number_of_dose: z.number(),
        coverages: coveragesSchema,
      })
    )
    .min(1),
})
export type UpdateInput = z.infer<typeof updateSchema>

/** Program plan params */
export const programPlanParamsSchema = IdParamsSchema
export type ProgramPlanParams = z.infer<typeof programPlanParamsSchema>

/** List queries */
export const listQueriesSchema = PaginationQueriesSchema.extend({
  material_id: z.coerce.number().optional(),
  activity_id: z.coerce.number().optional(),
})
export type ListQueries = z.infer<typeof listQueriesSchema>

/** Coverage params */
export const coverageParamsSchema = IdParamsSchema
export type CoverageParams = z.infer<typeof coverageParamsSchema>

/** Coverage queries */
export const coverageQueriesSchema = PaginationQueriesSchema.extend({
  province_id: z.coerce.number().optional(),
})
export type CoverageQueries = z.infer<typeof coverageQueriesSchema>

/** Detail params */
export const detailParamsSchema = IdParamsSchema
export type DetailParams = z.infer<typeof detailParamsSchema>
