import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { z } from "zod"

export const EthnicPaginatedRequestSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
})

export type EthnicPaginatedRequestDTO = z.infer<
  typeof EthnicPaginatedRequestSchema
>

export type EthnicSelectedColumns = {
  id: number
  title: string
}
