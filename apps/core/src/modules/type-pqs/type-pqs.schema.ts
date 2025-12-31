import { PaginationQueriesSchema } from "@smile/lib/types/paginate"
import z from "zod"

/* Query Params Schema */
export const GetTypePQsQueryParamsSchema = PaginationQueriesSchema

/* Query Params Type */
export type GetTypePQsQueryParams = z.infer<typeof GetTypePQsQueryParamsSchema>
