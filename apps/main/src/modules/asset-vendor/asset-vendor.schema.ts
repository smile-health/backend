import z from "zod"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import { STATUS } from "@/common/constants/general.js"

/* Param Schema */
export const GetAssetVendorsQueryParamsSchema = PaginationQueriesSchema.extend({
  status: z.coerce.number().optional(),
  asset_vendor_type_ids: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        return val.split(",").map((str) => Number(str))
      }
      return undefined
    },
    z.array(z.number().refine((n) => !isNaN(n))).optional()
  ),
  sort_by: z.enum(["name", "status", "updated_at"]).optional(),
  sort_type: z.enum(["asc", "desc"]).optional(),
})

export const GetAssetVendorParamSchema = IdParamsSchema

export const UpdateAssetVendorParamSchema = IdParamsSchema

/* Request Body Schema */
export const EditStatusAssetVendorRequestSchema = z.object({
  status: z.nativeEnum(STATUS),
})

/* Params Type */
export type GetAssetVendorsQueryParams = z.infer<
  typeof GetAssetVendorsQueryParamsSchema
>

/* Request Body Type */
export type EditStatusAssetVendorRequest = z.infer<
  typeof EditStatusAssetVendorRequestSchema
>
