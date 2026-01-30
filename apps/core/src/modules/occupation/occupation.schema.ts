import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const OccupationPaginatedRequestSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
})

export type OccupationPaginatedRequestDTO = z.infer<
  typeof OccupationPaginatedRequestSchema
>

export type OccupationSelectedColumns = {
  id: number
  title: string
}
