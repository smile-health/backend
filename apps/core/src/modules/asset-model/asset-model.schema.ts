import z from "zod"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL } from "@/common/constants/assets"

const capacityField = () =>
  z
    .union([z.string(), z.number()])
    .nullable()
    .nullish()
    .transform((val) => {
      if (val === null || val === undefined || val === "") return null

      if (typeof val === "number") {
        if (isNaN(val) || val < 0) return null
        return val
      }

      const normalized = val.toString().replace(",", ".").trim()

      if (normalized === "") return null

      const num = Number(normalized)

      if (isNaN(num) || num < 0) return null

      return num
    })

/* Base Schema */
export const AssetModelSchema = z.object({
  name: z.string().min(1).max(255),
  asset_type_id: z.number().positive(),
  manufacture_id: z.number().positive(),
  net_capacity: z.number().nullish(),
  gross_capacity: z.number().nullish(),
  program_ids: z.array(z.number().positive()).optional(),
  asset_type_temperature_id: z.number().positive().nullish().optional(),
  pqs_code_id: z.number().positive().nullable().nullish(),
  asset_model_id: z.number().positive(),
  workspace_id: z.number().positive(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  created_at: z.date(),
  updated_at: z.date(),
})

/* DTO Schema */
export const AuditAssetModelDTOSchema = AssetModelSchema.pick({
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
})

export const PartialAuditAssetModelDTOSchema = AuditAssetModelDTOSchema.pick({
  updated_by: true,
  updated_at: true,
})

export const AddAssetModelDTOSchema = AssetModelSchema.pick({
  name: true,
  asset_type_id: true,
  manufacture_id: true,
  pqs_code_id: true,
}).merge(AuditAssetModelDTOSchema)

export const EditAssetModelDTOSchema = AssetModelSchema.pick({
  name: true,
  asset_type_id: true,
  manufacture_id: true,
  net_capacity: true,
  gross_capacity: true,
}).merge(PartialAuditAssetModelDTOSchema)

export const AddAssetModelWorkspaceDTOSchema = AssetModelSchema.pick({
  asset_model_id: true,
  workspace_id: true,
}).merge(AuditAssetModelDTOSchema)

export const AssetModelsTemperatureCapacityDTOSchema = AssetModelSchema.pick({
  asset_model_id: true,
  asset_type_temperature_id: true,
  net_capacity: true,
  gross_capacity: true,
}).merge(AuditAssetModelDTOSchema)

export const AssetModelsTemperatureCapacityDTOUpdateSchema =
  AssetModelsTemperatureCapacityDTOSchema.pick({
    asset_model_id: true,
    asset_type_temperature_id: true,
    net_capacity: true,
    gross_capacity: true,
  }).merge(PartialAuditAssetModelDTOSchema)

/* Request Body Schema */
export const AddAssetModelRequestSchema = AssetModelSchema.pick({
  name: true,
  asset_type_id: true,
  manufacture_id: true,
})
  .extend({
    is_capacity: z
      .union([z.literal("0"), z.literal("1"), z.literal(0), z.literal(1)])
      .transform((val) => {
        if (val === "0" || val === 0) return 0
        if (val === "1" || val === 1) return 1
        return null
      }),
    asset_model_capacity: z
      .object({
        pqs_code_id: z.number().positive().nullable().nullish(),
        capacities: z
          .array(
            z.object({
              id: z.number().positive().nullable().default(null),
              id_temperature_threshold: z.number().positive().nullable(),
              net_capacity: z.number().positive(),
              gross_capacity: z.number().positive(),
            })
          )
          .max(3)
          .optional(),
      })
      .optional()
      .nullable()
      .nullish(),
  })
  .transform((val, ctx: z.RefinementCtx) => {
    const hasCapacities =
      Array.isArray(val.asset_model_capacity?.capacities) &&
      val.asset_model_capacity?.capacities.length > 0
        ? true
        : false

    if (val.is_capacity === 1 && hasCapacities === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.required",
        path: ["asset_model_capacity"],
      })
    }

    if (
      (val.is_capacity === 0 || val.is_capacity === null) &&
      hasCapacities === true
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_required",
        path: ["asset_model_capacity"],
      })
    }

    return val
  })

export const EditAssetModelRequestSchema = AddAssetModelRequestSchema

export const ImportAssetModelRowRequestSchema = z.object({
  ["name"]: z.string().min(1).max(255),
  ["asset_type_id"]: z.number().positive(),
  ["manufacture_id"]: z.number().positive(),
  ["pqs_code_id"]: z.number().positive().nullable().nullish(),
  ["net_capacity_plus_5"]: capacityField(),
  ["gross_capacity_plus_5"]: capacityField(),
  ["net_capacity_minus_20"]: capacityField(),
  ["gross_capacity_minus_20"]: capacityField(),
  ["net_capacity_minus_86"]: capacityField(),
  ["gross_capacity_minus_86"]: capacityField(),
  ["net_capacity_1"]: capacityField(),
  ["gross_capacity_1"]: capacityField(),
  ["net_capacity_2"]: capacityField(),
  ["gross_capacity_2"]: capacityField(),
  ["net_capacity_3"]: capacityField(),
  ["gross_capacity_3"]: capacityField(),
  ["is_capacity"]: z
    .union([z.literal("0"), z.literal("1"), z.literal(0), z.literal(1)])
    .default("0")
    .transform((val) => {
      if (val === "0" || val === 0) return 0
      if (val === "1" || val === 1) return 1
      return null
    }),
})

export const ImportAssetModelArrayRequestSchema = z.array(
  ImportAssetModelRowRequestSchema
)

/* Param Schema */
export const UpdateAssetModelParamSchema = IdParamsSchema

export const GetAssetModelParamSchema = IdParamsSchema

export const DownloadTemplateSchema = z.object({
  type: z
    .preprocess(
      (val) => (typeof val === "string" ? Number(val) : val),
      z.nativeEnum(TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL)
    )
    .default(TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITH_PQS),
})

export const ImportTemplateSchema = z.object({
  type: z.preprocess(
    (val) => (typeof val === "string" ? Number(val) : val),
    z.nativeEnum(TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL)
  ),
})

export const GetAssetModelsQueryParamsSchema = PaginationQueriesSchema.extend({
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
  program_ids: z.preprocess(
    (val) => {
      if (typeof val === "string") {
        return val.split(",").map((str) => Number(str))
      }
      return undefined
    },
    z.array(z.number().refine((n) => !isNaN(n))).optional()
  ),
  sort_by: z.enum(["name", "updated_at"]).default("updated_at"),
  sort_type: z.enum(["asc", "desc"]).default("desc"),
})

/* DTO Type */
export type AuditAssetModelDTO = z.infer<typeof AuditAssetModelDTOSchema>

export type PartialAuditAssetModelDTO = z.infer<
  typeof PartialAuditAssetModelDTOSchema
>

export type AddAssetModelDTO = z.infer<typeof AddAssetModelDTOSchema>

export type EditAssetModelDTO = z.infer<typeof EditAssetModelDTOSchema>

export type AddAssetModelWorkspaceDTO = z.infer<
  typeof AddAssetModelWorkspaceDTOSchema
>

export type AssetModelsTemperatureCapacityDTO = z.infer<
  typeof AssetModelsTemperatureCapacityDTOSchema
>

export type AssetModelsTemperatureCapacityDTOUpdate = z.infer<
  typeof AssetModelsTemperatureCapacityDTOUpdateSchema
>

/* Request Body Type */
export type AddAssetModelRequest = z.infer<typeof AddAssetModelRequestSchema>

export type EditAssetModelRequest = z.infer<typeof EditAssetModelRequestSchema>

export type ImportAssetModelRowRequest = z.infer<
  typeof ImportAssetModelRowRequestSchema
>

export type ImportAssetModelArrayRequest = z.infer<
  typeof ImportAssetModelArrayRequestSchema
>

/* Params Type */
export type GetAssetModelsQueryParams = z.infer<
  typeof GetAssetModelsQueryParamsSchema
>

export type DonwloadTemplateQueryParams = z.infer<typeof DownloadTemplateSchema>

export type ImportTemplateQueryParams = z.infer<typeof ImportTemplateSchema>
