import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const GetListProgramPlanSchema = PaginationQueriesSchema.extend({
  year: z.string().optional(),
  is_final: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  sort_by: z.enum(["year", "is_final", "updated_at"]).optional(),
  sort_type: z.enum(["asc", "desc"]).optional(),
}).refine(
  (data) => {
    if (
      (data.sort_by && !data.sort_type) ||
      (!data.sort_by && data.sort_type)
    ) {
      return false
    }
    return true
  },
  { message: "Both sort_by and sort_type must be provided together" }
)

export const SubmitProgramPlanSchema = z.object({
  year: z.string(),
  approach_id: z.number(),
})

export const SubmitSetStatusProgramPlanSchema = z.object({
  status: z.string(),
})

export type GetListProgramPlanQueries = z.infer<typeof GetListProgramPlanSchema>
export type SubmitProgramPlanRequest = z.infer<typeof SubmitProgramPlanSchema>
export type SubmitSetStatusProgramPlanRequest = z.infer<
  typeof SubmitSetStatusProgramPlanSchema
>
