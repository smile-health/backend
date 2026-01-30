import z from "zod"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { Selectable } from "kysely"
import { CONTACT_PERSON_SOURCE_TYPE } from "@/common/constants/assets.js"
import { STATUS, FLAG } from "@/common/constants/general.js"

export const AssetMonitoringDeviceSchema = z.object({
  id: z.number().positive(),
  asset_type_id: z.number().positive().nullable(),
  asset_model_id: z.number().positive().nullable(),
  manufacture_id: z.number().positive().nullable(),
  asset_vendor_id: z.number().positive().nullable(),
  asset_communication_provider_id: z.number().positive().nullable(),
  serial_number: z.string().max(255).nullable(),
  production_year: z.number().positive().nullable(),
  asset_rtmd_status_id: z.number().positive().nullable(),
  entity_id: z.number().positive().nullable(),
  budget_year: z.number().positive().nullable(),
  budget_source_id: z.number().positive().nullable(),
  status: z.number().positive().nullable(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  created_at: z.date(),
  updated_at: z.date(),
})

export const ContactPersonSchema = z.object({
  id: z.number().positive(),
  name: z.string().max(255).nullable(),
  phone: z.string().max(255).nullable(),
  source_id: z.number().positive().nullable(),
  source_type: z
    .enum([
      CONTACT_PERSON_SOURCE_TYPE.RTMD,
      CONTACT_PERSON_SOURCE_TYPE.ASSET_INVENTORY,
      CONTACT_PERSON_SOURCE_TYPE.OTHER,
    ])
    .nullable(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  created_at: z.date(),
  updated_at: z.date(),
})

export const AuditAssetMonitoringDeviceDTOSchema =
  AssetMonitoringDeviceSchema.pick({
    created_by: true,
    updated_by: true,
    created_at: true,
    updated_at: true,
  })

export const PartialAuditAssetMonitoringDeviceDTOSchema =
  AuditAssetMonitoringDeviceDTOSchema.pick({
    updated_by: true,
    updated_at: true,
  })

export const AddAssetMonitoringDeviceDTOSchema =
  AssetMonitoringDeviceSchema.pick({
    asset_type_id: true,
    asset_model_id: true,
    manufacture_id: true,
    asset_vendor_id: true,
    asset_communication_provider_id: true,
    serial_number: true,
    production_year: true,
    asset_rtmd_status_id: true,
    entity_id: true,
    budget_year: true,
    budget_source_id: true,
    status: true,
  }).merge(AuditAssetMonitoringDeviceDTOSchema)

export const EditAssetMonitoringDeviceDTOSchema =
  AssetMonitoringDeviceSchema.pick({
    asset_type_id: true,
    asset_model_id: true,
    manufacture_id: true,
    asset_vendor_id: true,
    asset_communication_provider_id: true,
    serial_number: true,
    production_year: true,
    asset_rtmd_status_id: true,
    entity_id: true,
    budget_year: true,
    budget_source_id: true,
    status: true,
  }).merge(PartialAuditAssetMonitoringDeviceDTOSchema)

export const AddContactPersonDTOSchema = ContactPersonSchema.pick({
  name: true,
  phone: true,
  source_id: true,
  source_type: true,
}).merge(AuditAssetMonitoringDeviceDTOSchema)

export const AddAssetMonitoringDeviceRequestSchema =
  AssetMonitoringDeviceSchema.pick({
    asset_type_id: true,
    asset_model_id: true,
    manufacture_id: true,
    asset_vendor_id: true,
    asset_communication_provider_id: true,
    serial_number: true,
    production_year: true,
    asset_rtmd_status_id: true,
    entity_id: true,
    budget_year: true,
    budget_source_id: true,
  })
    .extend({
      status: z.number().default(1),
      contact_persons: z
        .array(
          z.object({
            name: z.string().min(1).max(255),
            phone: z
              .string()
              .min(1)
              .max(50)
              .regex(/^[+]?[\d\s\-()]+$/),
          })
        )
        .min(1, "At least one contact person is required")
        .max(3, "Maximum 3 contact persons allowed"),
    })
    .refine(
      (data) => {
        if (data.production_year && data.budget_year) {
          return data.production_year <= data.budget_year
        }
        return true
      },
      {
        message: "Production Year must be lesser or equal than Budget Year",
        path: ["production_year"],
      }
    )
    .refine(
      (data) => {
        if (data.production_year && data.budget_year) {
          return data.budget_year >= data.production_year
        }
        return true
      },
      {
        message: "Budget Year must be greater or equal than Production Year",
        path: ["budget_year"],
      }
    )

export const EditAssetMonitoringDeviceRequestSchema =
  AssetMonitoringDeviceSchema.pick({
    asset_type_id: true,
    asset_model_id: true,
    manufacture_id: true,
    asset_vendor_id: true,
    asset_communication_provider_id: true,
    serial_number: true,
    production_year: true,
    asset_rtmd_status_id: true,
    entity_id: true,
    budget_year: true,
    budget_source_id: true,
  })
    .extend({
      contact_persons: z
        .array(
          z.object({
            name: z.string().min(1).max(255),
            phone: z
              .string()
              .min(1)
              .max(50)
              .regex(/^[+]?[\d\s\-()]+$/),
          })
        )
        .min(1, "At least one contact person is required")
        .max(3, "Maximum 3 contact persons allowed")
        .optional(),
    })
    .partial()
    .refine(
      (data) => {
        if (data.production_year && data.budget_year) {
          return data.production_year <= data.budget_year
        }
        return true
      },
      {
        message: "Production Year must be lesser or equal than Budget Year",
        path: ["production_year"],
      }
    )
    .refine(
      (data) => {
        if (data.production_year && data.budget_year) {
          return data.budget_year >= data.production_year
        }
        return true
      },
      {
        message: "Budget Year must be greater or equal than Production Year",
        path: ["budget_year"],
      }
    )

export const UpdateAssetMonitoringDeviceStatusSchema = z.object({
  status: z
    .number()
    .int()
    .refine((val) => val === STATUS.ACTIVE || val === STATUS.INACTIVE, {
      message: `Status must be either ${STATUS.INACTIVE} (inactive) or ${STATUS.ACTIVE} (active)`,
    }),
})

export const UpdateAssetMonitoringDeviceParamSchema = IdParamsSchema
export const EditAssetMonitoringDeviceParamSchema = IdParamsSchema
export const GetAssetMonitoringDeviceParamSchema = IdParamsSchema
export const DeleteAssetMonitoringDeviceParamSchema = IdParamsSchema

export const BulkDeleteAssetMonitoringDeviceRequestSchema = z.object({
  ids: z.array(z.number().positive()).min(1, "At least one ID is required"),
})

export const GetAssetMonitoringDevicesQueryParamsSchema =
  PaginationQueriesSchema.extend({
    page: z.coerce.number().optional().default(1),
    paginate: z.coerce.number().optional().default(10),
    asset_model_ids: z.preprocess(
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
    is_device_related: z
      .preprocess(Number, z.nativeEnum(FLAG))
      .optional()
      .describe("0 = belum terelasi, 1 = sudah terelasi"),
    keyword: z.string().optional(),
    province_id: z.string().optional(),
    city_id: z.string().optional(),
    health_center_id: z.string().optional(),
    rtmd_status_id: z.string().optional(),
    device_status_id: z.string().optional(),
    sort_by: z
      .enum(["serial_number", "status", "rtmd_status_name", "updated_at"])
      .optional(),
    sort_type: z.enum(["asc", "desc"]).optional(),
  })

export type AuditAssetMonitoringDeviceDTO = z.infer<
  typeof AuditAssetMonitoringDeviceDTOSchema
>
export type PartialAuditAssetMonitoringDeviceDTO = z.infer<
  typeof PartialAuditAssetMonitoringDeviceDTOSchema
>
export type AddAssetMonitoringDeviceDTO = z.infer<
  typeof AddAssetMonitoringDeviceDTOSchema
>
export type EditAssetMonitoringDeviceDTO = z.infer<
  typeof EditAssetMonitoringDeviceDTOSchema
>
export type AddContactPersonDTO = z.infer<typeof AddContactPersonDTOSchema>

export type AddAssetMonitoringDeviceRequest = z.infer<
  typeof AddAssetMonitoringDeviceRequestSchema
>
export type EditAssetMonitoringDeviceRequest = z.infer<
  typeof EditAssetMonitoringDeviceRequestSchema
>

export type GetAssetMonitoringDevicesQueryParams = z.infer<
  typeof GetAssetMonitoringDevicesQueryParamsSchema
>
export type BulkDeleteAssetMonitoringDeviceRequest = z.infer<
  typeof BulkDeleteAssetMonitoringDeviceRequestSchema
>

export interface Rtmd extends Selectable<RtmdDatabase> {
  id: number
  asset_type_id: number | null
  asset_model_id: number | null
  manufacture_id: number | null
  asset_vendor_id: number | null
  asset_communication_provider_id: number | null
  serial_number: string | null
  production_year: number | null
  asset_rtmd_status_id: number | null
  entity_id: number | null
  budget_year: number | null
  budget_source_id: number | null
  status: number | null
  created_at: Date
  updated_at: Date
  created_by: number | null
  updated_by: number | null
  deleted_at: Date | null
  deleted_by: number | null
}

export interface RtmdDatabase {
  id: number
  asset_type_id: number | null
  asset_model_id: number | null
  manufacture_id: number | null
  asset_vendor_id: number | null
  asset_communication_provider_id: number | null
  serial_number: string | null
  production_year: number | null
  asset_rtmd_status_id: number | null
  entity_id: number | null
  budget_year: number | null
  budget_source_id: number | null
  status: number | null
  created_at: Date
  updated_at: Date
  created_by: number | null
  updated_by: number | null
  deleted_at: Date | null
  deleted_by: number | null
}

export interface ContactPerson
  extends Omit<Selectable<ContactPersonDatabase>, "source_type"> {
  id: number
  name: string | null
  phone: string | null
  source_id: number | null
  source_type: CONTACT_PERSON_SOURCE_TYPE | null
  created_at: Date
  updated_at: Date
  created_by: number | null
  updated_by: number | null
  deleted_at: Date | null
  deleted_by: number | null
}

export interface ContactPersonDatabase {
  id: number
  name: string | null
  phone: string | null
  source_id: number | null
  source_type: CONTACT_PERSON_SOURCE_TYPE | null
  created_at: Date
  updated_at: Date
  created_by: number | null
  updated_by: number | null
  deleted_at: Date | null
  deleted_by: number | null
}

export interface RtmdResponse {
  id: number
  serial_number: string | null
  production_year: number | null
  budget_year: number | null
  created_at: string
  updated_at: string
  rtmd_status: {
    id: number
    name: string
  }

  working_status?: {
    id: number
    name: string
  } | null
  device_status?: {
    id: number
    name: string
  } | null
  asset_type?: {
    id: number
    name: string
  } | null
  asset_model?: {
    id: number
    name: string
  } | null
  manufacturer?: {
    id: number
    name: string
  } | null
  asset_vendor?: {
    id: number
    name: string
  } | null
  communication_provider?: {
    id: number
    name: string
  } | null
  entity?: {
    id: number
    name: string
    address?: string
    province_id?: string
    regency_id?: string
    province_name?: string
    regency_name?: string
  } | null
  budget_source?: {
    id: number
    name: string
  } | null
  created_by?: {
    id: number
    name: string
  } | null
  updated_by?: {
    id: number
    name: string
  } | null

  contact_persons?: Array<{
    id: number
    name: string | null
    phone: string | null
  }>
}

export interface RtmdListResponse {
  id: number
  serial_number: string | null
  production_year: string | null
  budget_year: number | null
  created_at: string
  updated_at: string
  rtmd_status: {
    id: number
    name: string
  }
  device_status?: {
    id: number
    name: string
  } | null
  asset_type?: {
    id: number
    name: string
  } | null
  asset_model?: {
    id: number
    name: string
  } | null
  manufacturer?: {
    id: number
    name: string
  } | null
  asset_vendor?: {
    id: number
    name: string
  } | null
  communication_provider?: {
    id: number
    name: string
  } | null
  entity?: {
    id: number
    name: string
    province_id?: string
    regency_id?: string
    province_name?: string
    regency_name?: string
  } | null
  budget_source?: {
    id: number
    name: string
  } | null
  created_by?: {
    id: number
    name: string
  } | null
  updated_by?: {
    id: number
    name: string
  } | null

  contact_persons?: Array<{
    id: number
    name: string | null
    phone: string | null
  }>
}

export interface RtmdPaginatedResponse {
  total_item: number
  item_per_page: number
  page: number
  total_page: number
  data: RtmdListResponse[]
}

export interface DeviceExportItem {
  id: number
  serial_number: string | null
  production_year: number | null
  budget_year: number | null
  longitude: number | null
  latitude: number | null
  created_at: Date
  updated_at: Date
  asset_type: { name: string } | null
  asset_model: { name: string } | null
  manufacture: { name: string } | null
  asset_vendor: { name: string } | null
  communication_provider: { name: string } | null
  asset_rtmd_status: { name: string } | null
  asset_status: { id: number; name: string }
  budget_source: { name: string } | null
  entity: {
    id: number
    name: string
    entity_type_name: string
    province_name: string
    city_name: string
    sub_district_name: string
    longitude: number | null
    latitude: number | null
  }
  created_by: { name: string } | null
  updated_by: { name: string } | null
  contact_persons: Array<{
    id: number
    name: string | null
    phone: string | null
  }>
}
