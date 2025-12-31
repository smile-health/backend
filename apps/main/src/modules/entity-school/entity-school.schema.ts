import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const EntitySchoolPaginatedRequestSchema =
  PaginationQueriesSchema.extend({
    sub_district_id: z.string().optional(),
    keyword: z.string().optional(),
  })

export type EntitySchoolPaginatedRequestDTO = z.infer<
  typeof EntitySchoolPaginatedRequestSchema
>
