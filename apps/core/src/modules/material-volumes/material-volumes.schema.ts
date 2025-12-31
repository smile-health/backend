import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import {
  isStringNumbers,
  transformStringNumbersToArrayNumbers,
} from "@smile/lib/utils.js"
import { Materials } from "@/common/infrastructure/database/types/db.js"
import { z } from "zod"
import { Selectable } from "kysely"

const preprocessToString = (value: unknown) =>
  typeof value === "number" ? String(value) : value

/* Base Schema */
export const MaterialVolumeSchema = z.object({
  id: z.number().positive(),
  material_id: z.number().positive(),
  manufacture_id: z.number().positive(),
  box_length: z.preprocess(
    (val) => (typeof val === "string" ? parseFloat(val) : val),
    z.number().nonnegative()
  ),
  box_width: z.preprocess(
    (val) => (typeof val === "string" ? parseFloat(val) : val),
    z.number().nonnegative()
  ),
  box_height: z.preprocess(
    (val) => (typeof val === "string" ? parseFloat(val) : val),
    z.number().nonnegative()
  ),
  unit_per_box: z.preprocess(
    (val) => (typeof val === "string" ? parseFloat(val) : val),
    z.number().positive()
  ),
  consumption_unit_per_distribution_unit: z.preprocess(
    (val) => (typeof val === "string" ? parseFloat(val) : val),
    z.number().positive()
  ),
  created_by: z.number().positive().nullish(),
  updated_by: z.number().positive().nullish(),
  deleted_by: z.number().positive().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/* Query Params Schema */
export const GetMaterialVolumesQueryParamSchema =
  PaginationQueriesSchema.extend({
    material_ids: z
      .string()
      .nullish()
      .refine((val) => !val || isStringNumbers(val))
      .transform((val) =>
        val ? transformStringNumbersToArrayNumbers(val) : null
      ),
    manufacture_ids: z
      .string()
      .nullish()
      .refine((val) => !val || isStringNumbers(val))
      .transform((val) =>
        val ? transformStringNumbersToArrayNumbers(val) : null
      ),
    material_type_ids: z
      .string()
      .nullish()
      .refine((val) => !val || isStringNumbers(val))
      .transform((val) =>
        val ? transformStringNumbersToArrayNumbers(val) : null
      ),
    sort_by: z
      .enum(
        [
          "material_name",
          "manufacture_name",
          "type_material_name",
          "updated_at",
        ],
        {
          message: "INVALID REQUEST SORT_BY",
        }
      )
      .default("updated_at"),
    sort_type: z
      .enum(["asc", "desc"], { message: "INVALID REQUEST SORT_TYPE" })
      .default("desc"),
  })

/* Request Body Schema */
export const CreateMaterialVolumeRequestSchema = MaterialVolumeSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  created_by: true,
  updated_by: true,
  deleted_by: true,
})

export const UpdateMaterialVolumeRequestSchema = MaterialVolumeSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  created_by: true,
  updated_by: true,
  deleted_by: true,
})

/* DTO Schema */
export const CreateMaterialVolumeDTOSchema = MaterialVolumeSchema.omit({
  id: true,
  consumption_unit_per_distribution_unit: true,
  created_at: true,
  updated_at: true,
})

export const UpdateMaterialVolumeDTOSchema = MaterialVolumeSchema.omit({
  id: true,
  created_by: true,
  created_at: true,
  updated_at: true,
})

/* Query Params Type */
export type GetMaterialVolumesQueryParams = z.infer<
  typeof GetMaterialVolumesQueryParamSchema
>

/* Request Body Type */
export type CreateMaterialVolumeRequest = z.infer<
  typeof CreateMaterialVolumeRequestSchema
>
export type UpdateMaterialVolumeRequest = z.infer<
  typeof UpdateMaterialVolumeRequestSchema
>

/* DTO Type */
export type MaterialVolumeDTO = z.infer<typeof MaterialVolumeSchema>
export type CreateMaterialVolumeDTO = z.infer<
  typeof CreateMaterialVolumeDTOSchema
>
export type UpdateMaterialVolumeDTO = z.infer<
  typeof UpdateMaterialVolumeDTOSchema
>

export type MaterialSchema = Selectable<Materials>
export type RowType = string | number | Date | null
