import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const ReactionPaginatedRequestSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
})

export type ReactionPaginatedRequestDTO = z.infer<
  typeof ReactionPaginatedRequestSchema
>

export type ReactionSelectedColumns = {
  id: number
  title: string
}
