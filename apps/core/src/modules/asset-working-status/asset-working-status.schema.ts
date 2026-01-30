import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetAssetWorkingStatusPaginationSchema = PaginationQueriesSchema

export type GetAssetWorkingStatusPagination = z.infer<
  typeof GetAssetWorkingStatusPaginationSchema
>