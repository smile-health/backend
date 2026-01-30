import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetListSubtypeSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
  material_type_id: z.string().optional(),
})

export type GetListSubtypeQueries = z.infer<typeof GetListSubtypeSchema>
