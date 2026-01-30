import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

// Schemas
export const MaterialUnitSchema = z.object({
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
  type: z
    .string({ required_error: "Type is required" })
    .max(255, { message: "Type must not exceed 255 characters." }),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullable(),
})

export const GetMaterialUnitsQueryParamsSchema = PaginationQueriesSchema.extend({
  type: z
    .string()
    .max(255, { message: "Type must not exceed 255 characters." })
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
