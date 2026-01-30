import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate"
import z from "zod"

/* Query Params Schema */
export const GetCceigatQueryParamsSchema = PaginationQueriesSchema

/* Query Params Type */
export type GetCceigatQueryParams = z.infer<typeof GetCceigatQueryParamsSchema>
