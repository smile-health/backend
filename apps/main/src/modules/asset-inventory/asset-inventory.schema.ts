import z, { nullable } from "zod"
import { DateSchema, IdParamsSchema } from "@smile/lib/types/param.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { STATUS } from "@/common/constants/general.js"

/* Base Schema */
export const AssetInventorySchema = z.object({
  asset_electricity_id: z.number().positive().nullish(),
  asset_electricity_name: z.string().min(1).max(255).nullish(),
  asset_model_id: z.number().positive().nullish(),
  asset_type_id: z.number().positive().nullish(),
  asset_working_status_id: z.number().positive(),
  borrowed_from_entity_id: z.number().positive().nullish(),
  budget_source_id: z.number().positive().nullish(),
  budget_year: z.number().positive(),
  calibration_asset_vendor_id: z.number().positive().nullish(),
  calibration_last_date: DateSchema.nullish(),
  calibration_schedule_id: z.number().positive().nullish(),
  contact_person_user_1_name: z.string().min(1).max(255),
  contact_person_user_1_number: z.string().min(4).max(20),
  contact_person_user_2_name: z.string().min(1).max(255).nullish(),
  contact_person_user_2_number: z.string().min(4).max(20).nullish(),
  contact_person_user_3_name: z.string().min(1).max(255).nullish(),
  contact_person_user_3_number: z.string().min(4).max(20).nullish(),
  created_at: z.date(),
  created_by: z.number().positive(),
  entity_id: z.number().positive(),
  maintenance_asset_vendor_id: z.number().positive().nullish(),
  maintenance_last_date: DateSchema.nullish(),
  maintenance_schedule_id: z.number().positive().nullish(),
  manufacture_id: z.number().positive().nullish(),
  ownership_qty: z.number(),
  ownership_status: z.literal(1).or(z.literal(2)),
  production_year: z.number(),
  program_id: z.number().positive(),
  serial_number: z.string().min(1).max(255),
  status: z.nativeEnum(STATUS),
  updated_at: z.date(),
  updated_by: z.number().positive(),
  warranty_asset_vendor_id: z.number().positive().nullish(),
  warranty_end_date: DateSchema.nullish(),
  warranty_start_date: DateSchema.nullish(),
  other_asset_model_name: z.string().min(1).max(255).nullish(),
  other_net_capacity: z.number().nullish(),
  other_gross_capacity: z.number().nullish(),
  other_asset_type_name: z.string().min(1).max(255).nullish(),
  other_min_temperature: z.number().nullish(),
  other_max_temperature: z.number().nullish(),
  other_manufacture_name: z.string().min(1).max(255).nullish(),
  other_budget_source_name: z.string().min(1).max(255).nullish(),
  other_borrowed_from_entity_name: z.string().min(1).max(255).nullish(),
})

/* DTO Schema */
export const AuditAssetInventoryDTOSchema = AssetInventorySchema.pick({
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
})

export const PartialAuditAssetInventoryDTOSchema =
  AuditAssetInventoryDTOSchema.pick({
    updated_by: true,
    updated_at: true,
  })

export const AddAssetInventoryDTOSchema = AssetInventorySchema.omit({
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
  status: true,
}).merge(AuditAssetInventoryDTOSchema)

export const EditAssetInventoryDTOSchema = AssetInventorySchema.omit({
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
  program_id: true,
  status: true,
}).merge(PartialAuditAssetInventoryDTOSchema)

export const EditStatusAssetInventoryDTOSchema = AssetInventorySchema.pick({
  status: true,
}).merge(PartialAuditAssetInventoryDTOSchema)

/* Request Body Schema */
export const AddAssetInventoryRequestSchema = AssetInventorySchema.omit({
  created_by: true,
  updated_by: true,
  created_at: true,
  updated_at: true,
  program_id: true,
  status: true,
})

export const EditAssetInventoryRequestSchema = AddAssetInventoryRequestSchema

export const EditStatusAssetInventoryRequestSchema = AssetInventorySchema.pick({
  status: true,
})

/* Param Schema */
export const UpdateAssetInventoryParamSchema = IdParamsSchema

export const GetAssetInventoryParamSchema = IdParamsSchema

export const GetAssetInventorysQueryParamsSchema =
  PaginationQueriesSchema.extend({
    province_id: z.coerce.number().optional(),
    regency_id: z.coerce.number().optional(),
    health_center_id: z.coerce.number().optional(),
    working_status_id: z.coerce.number().optional(),
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
    entity_tag_ids: z.preprocess(
      (val) => {
        if (typeof val === "string") {
          return val.split(",").map((str) => Number(str))
        }
        return undefined
      },
      z.array(z.number().refine((n) => !isNaN(n))).optional()
    ),
    asset_model_ids: z.preprocess(
      (val) => {
        if (typeof val === "string") {
          return val.split(",").map((str) => Number(str))
        }
        return undefined
      },
      z.array(z.number().refine((n) => !isNaN(n))).optional()
    ),
    sort_by: z
      .enum(["serial_number", "asset_type_name", "status", "name", "updated_at"])
      .optional(),
    sort_type: z.enum(["asc", "desc"]).optional(),
  })

export type assetNotif = {
  activity_id: number
  entity_id: number
  id: number
  material_id: number
  max: number | null
  min: number | null
  program_id: number | null
  material_name: string | null
  material_consumption_unit: string | null
  customer_entity_name: string | null
}

export type DataMessage = {
  manufacture: string | null
  asset_type: string | null
  asset_model: string | null
  serial_number: string | null
  entity_name: string | null
  next_schedule: string | null
  days: number | null
}

export type DataMessageWarranty = {
  manufacture: string | null
  asset_model: string | null
  serial_number: string | null
  entity_name: string | null
  warranty_end_date: string | null
}

export type DataMessageAssetStatusChanged = {
  manufacture: string | null
  asset_model: string | null
  serial_number: string | null
  entity_name: string | null
  status: string | null
  updated_at: string | null
}

/* DTO Type */
export type AuditAssetInventoryDTO = z.infer<
  typeof AuditAssetInventoryDTOSchema
>

export type PartialAuditAssetInventoryDTO = z.infer<
  typeof PartialAuditAssetInventoryDTOSchema
>

export type AddAssetInventoryDTO = z.infer<typeof AddAssetInventoryDTOSchema>

export type EditAssetInventoryDTO = z.infer<typeof EditAssetInventoryDTOSchema>

export type EditStatusAssetInventoryDTO = z.infer<
  typeof EditStatusAssetInventoryDTOSchema
>

/* Request Body Type */
export type AddAssetInventoryRequest = z.infer<
  typeof AddAssetInventoryRequestSchema
>

export type EditAssetInventoryRequest = z.infer<
  typeof EditAssetInventoryRequestSchema
>

export type EditStatusAssetInventoryRequest = z.infer<
  typeof EditStatusAssetInventoryRequestSchema
>

/* Params Type */
export type GetAssetInventorysQueryParams = z.infer<
  typeof GetAssetInventorysQueryParamsSchema
>
