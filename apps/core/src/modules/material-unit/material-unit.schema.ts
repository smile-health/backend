import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

// Schemas
export const MaterialUnitSchema = z.object({
  id: z.preprocess(
    (value) => (typeof value === "string" ? parseInt(value, 10) : value),
    z.int({
                error: "ID must be an integer."
          })
      .nonnegative({
          error: "ID must be a positive number."
    })
  ),
  name: z
    .string({
        error: (issue) => issue.input === undefined ? "Name is required" : undefined
    })
    .max(255, {
        error: "Name must not exceed 255 characters."
    }),
  type: z
    .string({
        error: (issue) => issue.input === undefined ? "Type is required" : undefined
    })
    .max(255, {
        error: "Type must not exceed 255 characters."
    }),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
})

export const GetMaterialUnitsQueryParamsSchema = PaginationQueriesSchema.extend({
  type: z
    .string()
    .max(255, {
        error: "Type must not exceed 255 characters."
    })
    .nullish(),
})

// Request
export type GetMaterialUnitsQueryParams = z.infer<
  typeof GetMaterialUnitsQueryParamsSchema
>

// Response
export type MaterialUnitResponse = z.infer<
  typeof MaterialUnitSchema
>
