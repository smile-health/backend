import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

// Schemas
export const MaterialRelationSchema = z.object({
  id: z.preprocess(
    (value) => (typeof value === "string" ? parseInt(value, 10) : value),
    z
      .int({
        error: "ID must be an integer.",
      })
      .nonnegative({
        error: "ID must be a positive number.",
      })
  ),
  child_material_id: z
    .int({
      error: "Material ID must be an integer",
    })
    .nonnegative({
      error: "Material ID must be a positive number",
    }),
  parent_material_id: z
    .int({
      error: "Workspace ID must be an integer",
    })
    .nonnegative({
      error: "Workspace ID must be a positive number",
    }),
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
    .string({
      error: (issue) =>
        issue.input === undefined ? "Name is required" : undefined,
    })
    .max(255, {
      error: "Name must not exceed 255 characters.",
    }),
  material_level_id: z
    .int({
      error: "Material Level ID be an integer.",
    })
    .nonnegative({
      error: "Material Level ID be a positive number.",
    }),
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
