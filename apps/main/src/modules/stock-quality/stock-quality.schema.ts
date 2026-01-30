import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const getListStockQualitySchema = PaginationQueriesSchema

export type GetListStockQualityQueries = z.infer<
  typeof getListStockQualitySchema
>
