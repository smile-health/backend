import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetAssetMaintenanceSchedulePaginationSchema =
  PaginationQueriesSchema

export type GetAssetMaintenanceSchedulePagination = z.infer<
  typeof GetAssetMaintenanceSchedulePaginationSchema
>