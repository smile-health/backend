import { FLAG } from "@/common/constants/general.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import z from "zod"

export const PushTemperatureHistoryDTOSchema = z.array(
  z.object({
    device_id: z.string(),
    curr_temp: z.number(),
    actual_date: z.string().optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    humidity: z.number().optional(),
    battery: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .optional(),
    signal: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .optional(),
    status_device: z.boolean().optional(),
    power: z.boolean().optional(),
  })
)

export const PushWarehouseTemperatureHistoryDTOSchema = z.array(
  z.object({
    device_id: z.string(),
    curr_temp: z.number(),
    actual_date: z.string().optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    humidity: z.number().optional(),
    battery: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .optional(),
    signal: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .optional()
      .default(0),
    status_device: z.boolean().optional(),
    power: z.boolean().optional().default(false),
  })
)

export const TemperatureHistoryItemSchema = z.object({
  device_id: z.string(),
  curr_temp: z.number(),
  actual_date: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  humidity: z.number().optional(),
  battery: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .optional(),
  signal: z.union([z.number(), z.string(), z.null(), z.undefined()]).optional(),
  status_device: z.boolean().optional(),
  power: z.boolean().optional(),
})

export const AuditTimestampSchema = z.object({
  created_at: z.date(),
  created_by: z.number().positive(),
  updated_at: z.date(),
  updated_by: z.number().positive(),
  deleted_at: z.date(),
  deleted_by: z.number().positive(),
})

export type TemperatureHistoryItem = z.infer<
  typeof PushTemperatureHistoryDTOSchema
>[0]

export type TemperatureHistoryResultItem = TemperatureHistoryItem & {
  message: string
  result: "success" | "error"
}

export const UpdateTemperatureThresholdDTOSchema = z.object({
  asset_model_temperature_capacity_id: z
    .number()
    .int()
    .positive("Asset model temperature capacity ID is required"),
})

export const UpdateTemperatureRangeParamSchema = IdParamsSchema

export const UpdateTemperatureRangeRequestSchema = z.object({
  temperature_threshold_id: z
    .number()
    .positive()
    .describe("Temperature threshold ID from temperature_thresholds table"),
})

export const GetTemperatureCapacityQueriesSchema =
  PaginationQueriesSchema.extend({
    asset_id: z.string().optional(),
    asset_model_id: z.string().optional(),
    serial_number: z.string().optional(),
    page: z.coerce.number().optional().default(1),
    paginate: z.coerce.number().optional().default(10),
  })

export const GetTemperatureHistoryQueriesSchema =
  PaginationQueriesSchema.extend({
    device_id: z.string().optional(),
    asset_id: z.string().optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
    page: z.coerce.number().optional().default(1),
    paginate: z.coerce.number().optional().default(10),
  })

export const UpdateTemperatureThresholdParamSchema = IdParamsSchema
export const GetTemperatureCapacityParamSchema = IdParamsSchema

export const PushTemperatureHistoryResponseSchema = z.object({
  data: z.array(
    z.object({
      device_id: z.string(),
      lat: z.number().optional(),
      lon: z.number().optional(),
      curr_temp: z.number(),
      battery: z.number().int().optional(),
      signal: z.number().int().optional(),
      humidity: z.number().optional(),
      message: z.string(),
      result: z.enum(["success", "error"]),
    })
  ),
  message: z.string(),
})

export const UpdateOperationalStatusRequestSchema = z.object({
  working_status_id: z
    .number()
    .positive()
    .describe("Working status ID from asset working statuses table"),
})

export const UpdateAuditTimestampDTOSchema = AuditTimestampSchema.pick({
  updated_by: true,
  updated_at: true,
})

export const UpdateOperationalStatusDTOSchema =
  UpdateOperationalStatusRequestSchema.pick({
    working_status_id: true,
  }).merge(UpdateAuditTimestampDTOSchema)

export type PushTemperatureHistoryDTO = z.infer<
  typeof PushTemperatureHistoryDTOSchema
>
export type UpdateTemperatureThresholdDTO = z.infer<
  typeof UpdateTemperatureThresholdDTOSchema
>
export type UpdateTemperatureRangeDTO = z.infer<
  typeof UpdateTemperatureRangeRequestSchema
>
export type GetTemperatureCapacityQueries = z.infer<
  typeof GetTemperatureCapacityQueriesSchema
>
export type GetTemperatureHistoryQueries = z.infer<
  typeof GetTemperatureHistoryQueriesSchema
>
export type PushTemperatureHistoryResponse = z.infer<
  typeof PushTemperatureHistoryResponseSchema
>

export type UpdateOperationalStatusRequestDTO = z.infer<
  typeof UpdateOperationalStatusRequestSchema
>

export type UpdateAuditTimestampDTO = z.infer<
  typeof UpdateAuditTimestampDTOSchema
>

export type UpdateOperationalStatusDTO = z.infer<
  typeof UpdateOperationalStatusDTOSchema
>

export interface TemperatureCapacityResponse {
  id: number
  asset_model_id: number
  asset_type_temperature_id: number
  gross_capacity: number
  net_capacity: number
  min_temperature?: number
  max_temperature?: number
  asset_type_name?: string
  asset_model_name?: string
  serial_number?: string
  entity_name?: string
  max_threshold?: number
  min_threshold?: number
  created_at: string
  updated_at: string
}

export type TemperatureCapacityListResponse = TemperatureCapacityResponse

export interface TemperatureHistoryResponse {
  id: number
  asset_rtmd_id: number
  latitude?: number
  longitude?: number
  temperature: number
  battery?: number
  signal?: number
  humidity?: number
  device_serial?: string
  asset_id?: number
  entity_name?: string
  created_at: string
}

export interface TemperatureCapacityPaginatedResponse {
  total_item: number
  item_per_page: number
  page: number
  total_page: number
  data: TemperatureCapacityListResponse[]
}

export interface TemperatureHistoryPaginatedResponse {
  total_item: number
  item_per_page: number
  page: number
  total_page: number
  data: TemperatureHistoryResponse[]
}

export interface AssetModelsTemperaturesCapacityDatabase {
  id: number
  asset_model_id: number | null
  asset_type_temperature_id: number | null
  gross_capacity: number | null
  net_capacity: number | null
  created_at: Date | null
  updated_at: Date | null
  created_by: number | null
  updated_by: number | null
  deleted_at: Date | null
  deleted_by: number | null
}

export interface AssetModelsTemperaturesCapacity
  extends Selectable<AssetModelsTemperaturesCapacityDatabase> {
  id: number
  asset_model_id: number | null
  asset_type_temperature_id: number | null
  gross_capacity: number | null
  net_capacity: number | null
  created_at: Date | null
  updated_at: Date | null
  created_by: number | null
  updated_by: number | null
  deleted_at: Date | null
  deleted_by: number | null
}

// Schema for main asset monitoring temperature endpoint
export const GetAssetMonitoringTemperatureQuerySchema = PaginationQueriesSchema.extend(
  {
    keyword: z.string().optional(),
    province_id: z.string().optional(),
    regency_id: z.string().optional(),
    health_center_id: z.coerce.number().optional(),
    working_status_id: z.coerce.number().optional(),
    is_device_related: z.preprocess(Number, z.nativeEnum(FLAG)).optional(),
    is_warehouse: z.preprocess(Number, z.nativeEnum(FLAG)).optional(),
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
    rtmd_manufacture_ids: z.preprocess(
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
      .enum(["serial_number", "asset_type_name", "working_status_name"])
      .optional(),
    sort_type: z.enum(["asc", "desc"]).optional(),
    temperature_filter: z.enum(["normal", "below", "above"]).optional(),
  }
)

export interface AssetMonitoringTemperatureDetail {
  // Detail Aset columns
  id: number
  serial_number: string
  asset_name: string
  asset_type_name: string
  asset_vendor_name: string
  manufacture_name: string
  entity_name: string

  // Status Operasional columns
  working_status_name: string
  working_status_id: number

  // Metadata
  created_at: string
  updated_at: string
}

export interface AssetMonitoringTemperatureResponse {
  data: AssetMonitoringTemperatureDetail[]
  pagination: {
    page: number
    paginate: number
    total: number
    total_pages: number
  }
}

/* Param Schema */
export const GetAssetMonitoringTemperatureParamSchema = IdParamsSchema

export type GetAssetMonitoringTemperatureQuery = z.infer<
  typeof GetAssetMonitoringTemperatureQuerySchema
>
