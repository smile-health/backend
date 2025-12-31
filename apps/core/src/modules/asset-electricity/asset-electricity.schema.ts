import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const GetAssetElectricityPaginationSchema = PaginationQueriesSchema

export type GetAssetElectricityPagination = z.infer<
  typeof GetAssetElectricityPaginationSchema
>