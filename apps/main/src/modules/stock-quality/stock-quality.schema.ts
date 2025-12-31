import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const getListStockQualitySchema = PaginationQueriesSchema

export type GetListStockQualityQueries = z.infer<
  typeof getListStockQualitySchema
>
