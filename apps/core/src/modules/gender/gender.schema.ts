import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const GenderPaginatedRequestSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
})

export type GenderPaginatedRequestDTO = z.infer<
  typeof GenderPaginatedRequestSchema
>

export type GenderSelectedColumns = {
  id: number
  title: string
}
