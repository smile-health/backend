import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import {
  isStringNumbers,
  transformStringNumbersToArrayNumbers,
} from "@smile/lib/utils.js"
import { z } from "zod"

const preprocessToString = (value: unknown) =>
  typeof value === "number" ? String(value) : value

/* Base Schema */
export const MaterialSchema = z.object({
  id: z.number().positive(),
  name: z.preprocess(preprocessToString, z.string().min(1).max(255)),
  description: z.preprocess(preprocessToString, z.string().max(255).nullish()),
  material_level_id: z.number().positive(),
  code: z.preprocess(preprocessToString, z.string().min(1).max(255)),
  hierarchy_code: z.preprocess(
    preprocessToString,
    z.string().min(1).max(255).nullish()
  ),
  unit_of_consumption_id: z.number().positive(),
  unit_of_distribution_id: z.number().positive(),
  consumption_unit_per_distribution_unit: z.number().positive(),
  min_retail_price: z.number().nonnegative(),
  max_retail_price: z.number().nonnegative(),
  is_temperature_sensitive: z.number().min(0).max(1),
  min_temperature: z.number().int().nullish(),
  max_temperature: z.number().int().nullish(),
  material_type_id: z.number().positive(),
  material_subtype_id: z.number().positive().optional().nullish(),
  is_managed_in_batch: z.number().min(0).max(1),
  is_stock_opname_mandatory: z.number().min(0).max(1).default(0),
  status: z.number().min(0).max(1),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().positive().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
  integration_client_id: z.number().nullish(),
  is_kfa: z.number().min(0).max(1).nullish(),
})

export const MaterialWorkspaceSchema = z.object({
  id: z.number().positive(),
  material_id: z.number().positive(),
  workspace_id: z.number().positive(),
  created_by: z.number().positive().nullish(),
  updated_by: z.number().positive().nullish(),
  deleted_by: z.number().positive().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

/* Query Params Schema */
export const GetMaterialsQueryParamSchema = PaginationQueriesSchema.extend({
  program_ids: z
    .string()
    .nullish()
    .refine((val) => !val || isStringNumbers(val))
    .transform((val) =>
      val ? transformStringNumbersToArrayNumbers(val) : null
    ),
  material_level_ids: z
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
  is_hierarchy: z
    .enum(["0", "1"], { message: "INVALID REQUEST IS HIERARCHY" })
    .transform((val) => Number(val))
    .optional(),
  sort_by: z
    .enum(
      [
        "name",
        "material_type",
        "material_level",
        "managed_in_batch",
        "updated_by",
        "created_at",
      ],
      {
        message: "INVALID REQUEST SORT_BY",
      }
    )
    .default("created_at"),
  sort_type: z
    .enum(["asc", "desc"], { message: "INVALID REQUEST SORT_TYPE" })
    .default("desc"),
  integration_client_id: z.number().nullish(),
})

export const GetTemplateQueryParamsSchema = z.object({
  material_level_id: z.preprocess(
    (value) => (typeof value === "string" ? parseInt(value, 10) : value),
    z.number().positive()
  ),
  is_hierarchy: z.preprocess(
    (value) => (typeof value === "string" ? parseInt(value, 10) : value),
    z.number().min(0).max(1)
  ),
})

/* Request Body Schema */
export const CreateMaterialRequestSchema = MaterialSchema.omit({
  id: true,
  status: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  created_by: true,
  updated_by: true,
  deleted_by: true,
}).extend({
  material_parent_ids: z.array(z.number().positive()).nullish(),
  program_ids: z.array(z.number().positive()).nullish(),
  is_hierarchy: z.number().min(0).max(1),
})

export const UpdateMaterialRequestSchema = MaterialSchema.omit({
  id: true,
  status: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  created_by: true,
  updated_by: true,
  deleted_by: true,
}).extend({
  material_parent_ids: z.array(z.number().positive()).nullish(),
  program_ids: z.array(z.number().positive()).nullish(),
  is_hierarchy: z.number().min(0).max(1),
})

export const UpdateStatusMaterialRequestSchema = MaterialSchema.pick({
  status: true,
})

export const CreateMaterialWorkSpaceRequestSchema =
  MaterialWorkspaceSchema.omit({
    id: true,
    created_at: true,
    updated_at: true,
    deleted_at: true,
  })

/* DTO Schema */
export const CreateMaterialDTOSchema = MaterialSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  integration_client_id: z.number().nullish(),
})

export const UpdateMaterialDTOSchema = MaterialSchema.omit({
  id: true,
  status: true,
  created_by: true,
  created_at: true,
  updated_at: true,
}).extend({
  integration_client_id: z.number().nullish(),
})

export const UpdateStatusMaterialDTOSchema = MaterialSchema.pick({
  status: true,
  updated_by: true,
})

/* Other Schema */
export const arrayNumber = z.number().transform((val) => [val])
export const arrayString = z.string().transform((val) => [val])

/* Query Params Type */
export type GetMaterialsQueryParams = z.infer<
  typeof GetMaterialsQueryParamSchema
>
export type GetTemplateQueryParams = z.infer<
  typeof GetTemplateQueryParamsSchema
>

/* Request Body Type */
export type CreateMaterialRequest = z.infer<typeof CreateMaterialRequestSchema>
export type UpdateMaterialRequest = z.infer<typeof UpdateMaterialRequestSchema>
export type UpdateStatusMaterialRequest = z.infer<
  typeof UpdateStatusMaterialRequestSchema
>
export type CreateMaterialWorkSpaceRequest = z.infer<
  typeof CreateMaterialWorkSpaceRequestSchema
>

/* DTO Type */
export type MaterialDTO = z.infer<typeof MaterialSchema>
export type CreateMaterialDTO = z.infer<typeof CreateMaterialDTOSchema>
export type UpdateMaterialDTO = z.infer<typeof UpdateMaterialDTOSchema>
export type UpdateStatusMaterialDTO = z.infer<
  typeof UpdateStatusMaterialDTOSchema
>
