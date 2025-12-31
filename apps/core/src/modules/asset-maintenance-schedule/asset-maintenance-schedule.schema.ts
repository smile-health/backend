import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const GetAssetMaintenanceSchedulePaginationSchema =
  PaginationQueriesSchema

export type GetAssetMaintenanceSchedulePagination = z.infer<
  typeof GetAssetMaintenanceSchedulePaginationSchema
>