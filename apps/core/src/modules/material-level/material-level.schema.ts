import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { z } from "zod"

// Schemas
export const MaterialLevelSchema = z.object({
  id: z.preprocess(
    (value) => (typeof value === "string" ? parseInt(value, 10) : value),
    z
      .number()
      .int({ message: "ID must be an integer." })
      .nonnegative({ message: "ID must be a positive number." })
  ),
  name: z
    .string({ required_error: "Name is required" })
    .max(255, { message: "Name must not exceed 255 characters." }),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
})

export const GetMaterialLevelsQueryParamsSchema = PaginationQueriesSchema.extend({
  enable_only: z
    .string()
    .optional()
    .refine((val) => !val || ["0", "1"].includes(val), {
      message: "enable_only must be 0 or 1",
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
