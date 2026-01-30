import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetAssetCalibrationSchedulePaginationSchema =
  PaginationQueriesSchema

export type GetAssetCalibrationSchedulePagination = z.infer<
  typeof GetAssetCalibrationSchedulePaginationSchema
>