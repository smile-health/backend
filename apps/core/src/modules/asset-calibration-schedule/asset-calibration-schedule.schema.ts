import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const GetAssetCalibrationSchedulePaginationSchema =
  PaginationQueriesSchema

export type GetAssetCalibrationSchedulePagination = z.infer<
  typeof GetAssetCalibrationSchedulePaginationSchema
>