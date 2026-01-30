import { IdParamsSchema } from "@smile-health/lib/types/param"
import z from "zod"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { STATUS_CAPACITY_COLDSTORAGE } from "@/common/constants/assets"

export const stringToPositiveInt = (val: unknown): number | undefined => {
  if (typeof val !== "string") return undefined
  if (val.trim() === "") return undefined

  const num = Number(val.trim())
  if (isNaN(num) || !Number.isInteger(num) || num <= 0) {
    return undefined
  }

  return num
}

/* Base Schema */
export const ColdStorageSchema = z.object({
  entity_id: z.number().positive(),
  material_id: z.number().positive(),
  material_ids: z.array(z.number().positive()).optional(),
  user_id: z.number().positive().optional(),
  program_id: z.number().positive(),
  quantity: z.number().positive(),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  created_at: z.date(),
  updated_at: z.date(),
})

/* Request Body Schema */
export const AddColdStorageRequestSchema = ColdStorageSchema.pick({
  entity_id: true,
  material_id: true,
  user_id: true,
}).extend({
  program_id: z.number().positive(),
  is_send_notification: z.boolean().default(false).optional(),
})

export const BulkAddColdStorageRequestSchema = ColdStorageSchema.pick({
  entity_id: true,
  material_ids: true,
  user_id: true,
}).extend({
  program_id: z.number().positive(),
})

/* Param Schema */
export const GetColdStorageParamSchema = IdParamsSchema

/* Query Schema */
export const GetDetailColdstorageParamSchema = z.object({
  program_id: z.string().optional(),
})

export const GetColdstorageListQuerySchema = PaginationQueriesSchema.extend({
  capacities_status: z
    .enum(["empty", "low", "normal", "high"], {
      message: "INVALID REQUEST CAPACITY STATUS",
    })
    .optional(),
  province_id: z.preprocess(
    (val) => stringToPositiveInt(val),
    z.number().positive().optional()
  ),
  regency_id: z.preprocess(
    (val) => stringToPositiveInt(val),
    z.number().positive().optional()
  ),
  entity_tag_id: z.preprocess(
    (val) => stringToPositiveInt(val),
    z.number().positive().optional()
  ),
  health_facility_id: z.preprocess(
    (val) => stringToPositiveInt(val),
    z.number().positive().optional()
  ),
  sort_by: z
    .enum(["entity_name", "total_volume", "percentage_capacity"], {
      message: "INVALID REQUEST SORT_BY",
    })
    .optional(),
  sort_type: z
    .enum(["asc", "desc"], { message: "INVALID REQUEST SORT_TYPE" })
    .optional(),
})

/* Request Body Type */
export type AddColdStorageRequest = z.infer<typeof AddColdStorageRequestSchema>
export type BulkAddColdStorageRequest = z.infer<
  typeof BulkAddColdStorageRequestSchema
>

/* Query Type */
export type GetDetailColdstorageParam = z.infer<
  typeof GetDetailColdstorageParamSchema
>
export type GetColdstorageListQuery = z.infer<
  typeof GetColdstorageListQuerySchema
>
