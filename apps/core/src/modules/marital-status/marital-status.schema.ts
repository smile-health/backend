import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const MaritalStatusPaginatedRequestSchema =
  PaginationQueriesSchema.extend({
    keyword: z.string().optional(),
  })

export type MaritalStatusPaginatedRequestDTO = z.infer<
  typeof MaritalStatusPaginatedRequestSchema
>

export type MaritalStatusSelectedColumns = {
  id: number
  title: string
}
