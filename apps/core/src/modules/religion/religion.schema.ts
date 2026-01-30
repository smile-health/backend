import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const ReligionPaginatedRequestSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
})

export type ReligionPaginatedRequestDTO = z.infer<
  typeof ReligionPaginatedRequestSchema
>

export type ReligionSelectedColumns = {
  id: number
  title: string
}
