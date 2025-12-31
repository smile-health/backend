import z from "zod"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import { STATUS } from "@/common/constants/general.js"

/* Param Schema */
export const GetAssetTypesQueryParamsSchema = PaginationQueriesSchema.extend({
  status: z.coerce.number().optional(),
  sort_by: z.enum(["name", "status", "updated_at"]).optional(),
  sort_type: z.enum(["asc", "desc"]).optional(),
})

export const GetAssetTypeParamSchema = IdParamsSchema

export const UpdateAssetTypeParamSchema = IdParamsSchema

/* Request Body Schema */
export const EditStatusAssetTypeRequestSchema = z.object({
  status: z.nativeEnum(STATUS),
})

/* Params Type */
export type GetAssetTypesQueryParams = z.infer<
  typeof GetAssetTypesQueryParamsSchema
>

/* Request Body Type */
export type EditStatusAssetTypeRequest = z.infer<
  typeof EditStatusAssetTypeRequestSchema
>
