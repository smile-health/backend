import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetAssetVendorTypesPaginationSchema = PaginationQueriesSchema

export type GetAssetVendorTypesPagination = z.infer<
  typeof GetAssetVendorTypesPaginationSchema
>
