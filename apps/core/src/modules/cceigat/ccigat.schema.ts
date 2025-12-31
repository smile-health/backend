import { PaginationQueriesSchema } from "@smile/lib/types/paginate"
import z from "zod"

/* Query Params Schema */
export const GetCceigatQueryParamsSchema = PaginationQueriesSchema

/* Query Params Type */
export type GetCceigatQueryParams = z.infer<typeof GetCceigatQueryParamsSchema>
