import z from "zod"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { FLAG } from "@/common/constants/general"
import { TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE } from "@/common/constants/assets"
import { tr } from "@faker-js/faker/."

/* Base Schema */
export const AssetTypeSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullish(),
  min_temperature: z.number().nullish().optional(),
  max_temperature: z.number().nullish().optional(),
  program_ids: z.array(z.number().positive()).optional(),
  asset_type_id: z.number().positive(),
  workspace_id: z.number().positive(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  created_at: z.date(),
  updated_at: z.date(),
  integration_client_id: z.number().nullish(),
  is_temperature_adjustable: z
    .union([
      z.literal("0"),
      z.literal("1"),
      z.literal(0),
      z.literal(1),
      z.null(),
      z.undefined(),
    ])
    .default(0)
    .transform((val) => {
      if (val === "0" || val === 0) return 0
      if (val === "1" || val === 1) return 1
      return null
    }),
  is_warehouse: z
    .union([
      z.literal("0"),
      z.literal("1"),
      z.literal(0),
      z.literal(1),
      z.null(),
      z.undefined(),
    ])
    .default(0)
    .transform((val) => {
      if (val === "0" || val === 0) return 0
      if (val === "1" || val === 1) return 1
      return null
    }),
  is_cce_warehouse: z
    .union([
      z.literal("0"),
      z.literal("1"),
      z.literal(0),
      z.literal(1),
      z.null(),
      z.undefined(),
    ])
    .default(0)
    .transform((val) => {
      if (val === "0" || val === 0) return 0
      if (val === "1" || val === 1) return 1
      return null
    }),
})

/* DTO Schema */
export const AuditAssetTypeDTOSchema = AssetTypeSchema.pick({
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
})

export const PartialAuditAssetTypeDTOSchema = AuditAssetTypeDTOSchema.pick({
  updated_by: true,
  updated_at: true,
})

export const AddAssetTypeDTOSchema = AssetTypeSchema.pick({
  name: true,
  description: true,
  min_temperature: true,
  max_temperature: true,
})
  .merge(AuditAssetTypeDTOSchema)
  .extend({
    integration_client_id: z.number().nullish(),
  })

export const EditAssetTypeDTOSchema = AssetTypeSchema.pick({
  name: true,
  description: true,
  min_temperature: true,
  max_temperature: true,
})
  .merge(PartialAuditAssetTypeDTOSchema)
  .extend({
    integration_client_id: z.number().nullish(),
  })

export const AddAssetTypeWorkspaceDTOSchema = AssetTypeSchema.pick({
  asset_type_id: true,
  workspace_id: true,
}).merge(AuditAssetTypeDTOSchema)

/* Request Body Schema */
export const AddAssetTypeRequestSchema = AssetTypeSchema.pick({
  name: true,
  description: true,
  is_temperature_adjustable: true,
  is_warehouse: true,
  is_cce_warehouse: true,
}).extend({
  is_cce: z
    .union([
      z.literal("0"),
      z.literal("1"),
      z.literal(0),
      z.literal(1),
      z.null(),
      z.undefined(),
    ])
    .default(0)
    .transform((val) => {
      if (val === "0" || val === 0) return 0
      if (val === "1" || val === 1) return 1
      return null
    }),
  temperature_thresholds: z
    .array(
      z.object({
        id: z.number().positive(),
      })
    )
    .optional(),
  integration_client_id: z.number().nullish(),
  external_properties: z.record(z.any()).nullish(),
})

export const AddAssetTypeImportSchema = AssetTypeSchema.pick({
  name: true,
  description: true,
  is_temperature_adjustable: true,
  is_cce_warehouse: true,
}).extend({
  is_cce: z
    .union([
      z.literal("0"),
      z.literal("1"),
      z.literal(0),
      z.literal(1),
      z.null(),
      z.undefined(),
    ])
    .transform((val) => {
      if (val === "0" || val === 0) return 0
      if (val === "1" || val === 1) return 1
      return null
    }),
  temperature_thresholds: z.string().nullish(),
})

export const EditAssetTypeRequestSchema = AddAssetTypeRequestSchema.extend({
  integration_client_id: z.number().nullish(),
  external_properties: z.record(z.any()).nullish(),
})

export const ImportAssetTypeRowRequestSchema = z.object({
  ["name"]: z.string().min(1).max(255),
  ["description"]: z.string().nullish(),
  ["temperature_thresholds"]: z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .nullable()
    .transform((val) => {
      if (val === null || val === undefined || val === "") {
        return null
      }
      const str = String(val).trim()
      return str === "" ? null : str
    }),
  ["is_cce"]: z
    .union([
      z.literal("0"),
      z.literal("1"),
      z.literal(0),
      z.literal(1),
      z.null(),
      z.undefined(),
    ])
    .transform((val) => {
      if (val === "0" || val === 0) return 0
      if (val === "1" || val === 1) return 1
      return null
    }),
  ["is_temperature_adjustable"]: z
    .union([
      z.literal("0"),
      z.literal("1"),
      z.literal(0),
      z.literal(1),
      z.null(),
      z.undefined(),
    ])
    .default(0)
    .transform((val) => {
      if (val === "0" || val === 0) return 0
      if (val === "1" || val === 1) return 1
      return null
    }),
  ["is_cce_warehouse"]: z
    .union([
      z.literal("0"),
      z.literal("1"),
      z.literal(0),
      z.literal(1),
      z.null(),
      z.undefined(),
    ])
    .default(0)
    .transform((val) => {
      if (val === "0" || val === 0) return 0
      if (val === "1" || val === 1) return 1
      return null
    }),
})

export const ImportAssetTypeArrayRequestSchema = z.array(
  ImportAssetTypeRowRequestSchema
)

export const DownloadTemplateSchema = z.object({
  type_download_template: z
    .preprocess(
      (val) => (typeof val === "string" ? Number(val) : val),
      z.nativeEnum(TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE)
    )
    .default(TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_CCE),
})

export const ImportTemplateSchema = z.object({
  type_download_template: z.preprocess(
    (val) => (typeof val === "string" ? Number(val) : val),
    z.nativeEnum(TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE)
  ),
})

/* Param Schema */
export const UpdateAssetTypeParamSchema = IdParamsSchema

export const GetAssetTypeParamSchema = IdParamsSchema

export const GetAssetTypesQueryParamsSchema = PaginationQueriesSchema.extend({
  is_cce: z
    .enum(["0", "1"], { message: "INVALID REQUEST IS_CCE" })
    .transform((val) => Number(val))
    .optional(),
  type_by: z.enum(["rtmd"]).optional(),
  sort_by: z
    .enum(["name", "updated_at"], { message: "INVALID REQUEST SORT_BY" })
    .default("updated_at"),
  sort_type: z
    .enum(["asc", "desc"], { message: "INVALID REQUEST SORT_TYPE" })
    .default("desc"),
  integration_client_id: z.number().nullish(),
  is_related_asset: z
    .enum(["0", "1"], { message: "INVALID REQUEST IS_RELATED_ASSET" })
    .transform((val) => Number(val))
    .optional(),
  dashboard_filter: z.string().nullish(),
  is_warehouse: z.preprocess(Number, z.nativeEnum(FLAG)).optional(),
  is_cce_warehouse: z.preprocess(Number, z.nativeEnum(FLAG)).optional(),
})

/* DTO Type */
export type AuditAssetTypeDTO = z.infer<typeof AuditAssetTypeDTOSchema>

export type PartialAuditAssetTypeDTO = z.infer<
  typeof PartialAuditAssetTypeDTOSchema
>

export type AddAssetTypeDTO = z.infer<typeof AddAssetTypeDTOSchema>

export type EditAssetTypeDTO = z.infer<typeof EditAssetTypeDTOSchema>

export type AddAssetTypeWorkspaceDTO = z.infer<
  typeof AddAssetTypeWorkspaceDTOSchema
>

/* Request Body Type */
export type AddAssetTypeRequest = z.infer<typeof AddAssetTypeRequestSchema>
export type AddAssetTypeImport = z.infer<typeof AddAssetTypeImportSchema>

export type EditAssetTypeRequest = z.infer<typeof EditAssetTypeRequestSchema>

export type ImportAssetTypeRowRequest = z.infer<
  typeof ImportAssetTypeRowRequestSchema
>

export type ImportAssetTypeArrayRequest = z.infer<
  typeof ImportAssetTypeArrayRequestSchema
>

/* Params Type */
export type GetAssetTypesQueryParams = z.infer<
  typeof GetAssetTypesQueryParamsSchema
>

export type DownloadTemplateQueryParams = z.infer<typeof DownloadTemplateSchema>

export type ImportTemplateQueryParams = z.infer<typeof ImportTemplateSchema>

export type RowType = string | number | Date | null | undefined | unknown
export const toArrayInt = (values: string): number[] =>
  values
    .split(/[,;.]/)
    .map((v) => v.trim())
    .filter((v) => v !== "" || v !== null)
    .map((v) => {
      const num = Number(v)
      if (isNaN(num)) {
        throw new Error(`Invalid number: "${v}"`)
      }
      return num
    })
