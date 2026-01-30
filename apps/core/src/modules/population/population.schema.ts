import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const GetPopulationQueriesSchema = PaginationQueriesSchema.extend({
  sort_by: z.enum(["year", "updated_at"]).optional(),
  sort_type: z.enum(["asc", "desc"]).optional(),
})
export type GetPopulationQueries = z.infer<typeof GetPopulationQueriesSchema>

export const GetPopulationDetailParamsSchema = z.object({
  year: z.coerce.number(),
})
export type GetPopulationDetailParams = z.infer<
  typeof GetPopulationDetailParamsSchema
>

export const GetPopulationDetailQueriesSchema = z.object({
  province_id: z.coerce.number(),
})
export type GetPopulationDetailQueries = z.infer<
  typeof GetPopulationDetailQueriesSchema
>
