import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { z } from "zod"

// Schemas
export const MaterialRelationSchema = z.object({
  id: z.preprocess(
    (value) => (typeof value === "string" ? parseInt(value, 10) : value),
    z
      .number()
      .int({ message: "ID must be an integer." })
      .nonnegative({ message: "ID must be a positive number." })
  ),
  child_material_id: z
    .number()
    .int({ message: "Material ID must be an integer" })
    .nonnegative({ message: "Material ID must be a positive number" }),
  parent_material_id: z
    .number()
    .int({ message: "Workspace ID must be an integer" })
    .nonnegative({ message: "Workspace ID must be a positive number" }),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
})

export const GetMaterialRelationsQueryParamsSchema = PaginationQueriesSchema

export const CreateMaterialRelationRequestSchema = MaterialRelationSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
})

export const MaterialRelationDetailDTOSchema = MaterialRelationSchema.pick({
  id: true,
  child_material_id: true,
  parent_material_id: true,
}).extend({
  name: z
    .string({ required_error: "Name is required" })
    .max(255, { message: "Name must not exceed 255 characters." }),
  material_level_id: z
    .number({ required_error: "Material Level ID is required" })
    .int({ message: "Material Level ID be an integer." })
    .nonnegative({ message: "Material Level ID be a positive number." }),
})

// Request
export type GetMaterialRelationsQueryParams = z.infer<
  typeof GetMaterialRelationsQueryParamsSchema
>
export type CreateMaterialRelationRequest = z.infer<
  typeof CreateMaterialRelationRequestSchema
>

// DTO
export type MaterialRelationDetailDTO = z.infer<
  typeof MaterialRelationDetailDTOSchema
>
