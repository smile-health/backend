import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

// Schemas
export const MaterialLevelSchema = z.object({
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
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
})

export const GetMaterialLevelsQueryParamsSchema = PaginationQueriesSchema.extend({
  enable_only: z
    .string()
    .optional()
    .refine((val) => !val || ["0", "1"].includes(val), {
        error: "enable_only must be 0 or 1"
    }),
})

// Request
export type GetMaterialLevelsQueryParams = z.infer<
  typeof GetMaterialLevelsQueryParamsSchema
>

// Response
export type MaterialLevelResponse = z.infer<
  typeof MaterialLevelSchema
>
