import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { z } from "zod"

export const EducationPaginatedRequestSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
})

export type EducationPaginatedRequestDTO = z.infer<
  typeof EducationPaginatedRequestSchema
>

export type EducationSelectedColumns = {
  id: number
  title: string
}
