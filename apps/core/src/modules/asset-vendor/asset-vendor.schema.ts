import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import z from "zod"

/* Base Schema */
export const AssetVendorSchema = z.object({
  name: z.string().min(1).max(255),
  asset_vendor_type_id: z.number().positive(),
  description: z.string().nullish(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  created_at: z.date(),
  updated_at: z.date(),
})

/* DTO Schema */
export const AuditAssetVendorDTOSchema = AssetVendorSchema.pick({
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
})

export const PartialAuditAssetVendorDTOSchema = AuditAssetVendorDTOSchema.pick({
  updated_by: true,
  updated_at: true,
})

export const AddAssetVendorDTOSchema = AssetVendorSchema.pick({
  name: true,
  asset_vendor_type_id: true,
  description: true,
}).merge(AuditAssetVendorDTOSchema)

export const EditAssetVendorDTOSchema = AssetVendorSchema.pick({
  name: true,
  asset_vendor_type_id: true,
  description: true,
}).merge(PartialAuditAssetVendorDTOSchema)

/* Request Body Schema */
export const AddAssetVendorRequestSchema = AssetVendorSchema.pick({
  name: true,
  asset_vendor_type_id: true,
  description: true,
})

export const EditAssetVendorRequestSchema = AddAssetVendorRequestSchema

export const ImportAssetVendorRowRequestSchema = z.object({
  ["name"]: z.string().min(1).max(255),
  ["asset_vendor_type_id"]: z.number().positive(),
  ["description"]: z.string().nullish(),
})

export const ImportAssetVendorArrayRequestSchema = z.array(
  ImportAssetVendorRowRequestSchema
)

/* Param Schema */
export const UpdateAssetVendorParamSchema = IdParamsSchema

export const GetAssetVendorParamSchema = IdParamsSchema

export const GetAssetVendorsQueryParamsSchema = PaginationQueriesSchema.extend({
  asset_vendor_type_ids: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        return val.split(",").map((str) => Number(str))
      }
      return undefined
    },
    z.array(z.number().refine((n) => !isNaN(n))).optional()
  ),
  exclude_asset_vendor_type_ids: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        return val.split(",").map((str) => Number(str))
      }
      return undefined
    },
    z.array(z.number().refine((n) => !isNaN(n))).optional()
  ),
  sort_by: z.enum(["name", "updated_at"]).optional(),
  sort_type: z.enum(["asc", "desc"]).optional(),
  is_provider: z
    .union([z.literal(0), z.literal(1), z.literal("0"), z.literal("1")])
    .transform((val) => Number(val))
    .optional(),
})

/* DTO Type */
export type AuditAssetVendorDTO = z.infer<typeof AuditAssetVendorDTOSchema>

export type PartialAuditAssetVendorDTO = z.infer<
  typeof PartialAuditAssetVendorDTOSchema
>

export type AddAssetVendorDTO = z.infer<typeof AddAssetVendorDTOSchema>

export type EditAssetVendorDTO = z.infer<typeof EditAssetVendorDTOSchema>

/* Request Body Type */
export type AddAssetVendorRequest = z.infer<typeof AddAssetVendorRequestSchema>

export type EditAssetVendorRequest = z.infer<
  typeof EditAssetVendorRequestSchema
>

export type ImportAssetVendorRowRequest = z.infer<
  typeof ImportAssetVendorRowRequestSchema
>

export type ImportAssetVendorArrayRequest = z.infer<
  typeof ImportAssetVendorArrayRequestSchema
>

/* Params Type */
export type GetAssetVendorsQueryParams = z.infer<
  typeof GetAssetVendorsQueryParamsSchema
>
