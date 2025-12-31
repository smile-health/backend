import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const GetAssetVendorTypesPaginationSchema = PaginationQueriesSchema

export type GetAssetVendorTypesPagination = z.infer<
  typeof GetAssetVendorTypesPaginationSchema
>
