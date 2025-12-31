import z from "zod"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import { STATUS } from "@/common/constants/general.js"

/* Param Schema */
export const GetAssetModelsQueryParamsSchema = PaginationQueriesSchema.extend({
  status: z.coerce.number().optional(),
  asset_type_ids: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        return val.split(",").map((str) => Number(str))
      }
      return undefined
    },
    z.array(z.number().refine((n) => !isNaN(n))).optional()
  ),
  manufacture_ids: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        return val.split(",").map((str) => Number(str))
      }
      return undefined
    },
    z.array(z.number().refine((n) => !isNaN(n))).optional()
  ),
  sort_by: z
    .enum(["name", "net_capacity", "gross_capacity", "status", "updated_at"])
    .optional(),
  sort_type: z.enum(["asc", "desc"]).optional(),
})

export const GetAssetModelParamSchema = IdParamsSchema

export const UpdateAssetModelParamSchema = IdParamsSchema

/* Request Body Schema */
export const EditStatusAssetModelRequestSchema = z.object({
  status: z.nativeEnum(STATUS),
})

/* Params Type */
export type GetAssetModelsQueryParams = z.infer<
  typeof GetAssetModelsQueryParamsSchema
>

/* Request Body Type */
export type EditStatusAssetModelRequest = z.infer<
  typeof EditStatusAssetModelRequestSchema
>
