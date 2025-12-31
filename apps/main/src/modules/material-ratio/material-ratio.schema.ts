import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdSchema } from "@smile/lib/types/param.js"
import { parseCommaSeparatedIds } from "@smile/lib/utils.js"
import z from "zod"

/**
 * Transforms an optional comma-separated string of IDs into an array of numbers.
 */
export const materialIdQueryTransform = z
  .string()
  .optional()
  .transform(parseCommaSeparatedIds)

/**
 * Create
 */
export const createSchema = z.object({
  program_plan_id: z.number().nonnegative(),
  from_subtype_id: z.number().nonnegative(),
  from_material_id: z.number().nonnegative(),
  from_material_qty: z.number().positive(),
  to_subtype_id: z.number().nonnegative(),
  to_material_id: z.number().nonnegative(),
  to_material_qty: z.number().positive(),
})
export type CreateInput = z.infer<typeof createSchema>

/**
 * Update
 */
export const updateSchema = createSchema.omit({
  program_plan_id: true,
})
export type UpdateInput = z.infer<typeof updateSchema>

/**
 * List Param
 */
export const programPlanParamsSchema = z.object({
  programPlanId: IdSchema,
})
export type ProgramPlanParams = z.infer<typeof programPlanParamsSchema>

/**
 * List Query
 */
export const listQueriesSchema = PaginationQueriesSchema.extend({
  material_id: materialIdQueryTransform,
})
export type ListQueries = z.infer<typeof listQueriesSchema>
