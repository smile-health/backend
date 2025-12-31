import { STATUS } from "@/common/constants/manufacture.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { z } from "zod"

/*
 * Validation Rules
 */
const ManufactureSchema = z
  .object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    type: z.number().nullable(),
    reference_id: z.string().nullable(),
    description: z.string().nullable(),
    contact_name: z.string().nullable(),
    phone_number: z.string().nullable(),
    email: z.string().nullable(),
    address: z.string().nullable(),
    status: z.nativeEnum(STATUS).nullable(),
    created_by: z.number().nullable(),
    updated_by: z.number().nullable(),
    deleted_by: z.number().nullable(),
    created_at: z.date().nullable(),
    updated_at: z.date().nullable(),
    deleted_at: z.date().nullable(),
    village_id: z.string().nullable(),
    production_date: z.date().nullable(),
    production_year: z.number().nullable(),
    is_asset: z.number().nullable(),
    global_id: z.number().nullable(),
  })
  .partial()

/*
 * Use Case
 */
export const ManufactureSyncSchema = ManufactureSchema.extend({
  global_id: z.number().optional(),
  workspace_ids: z.array(z.number()).optional(),
  created_at: z
    .string()
    .transform((str) => new Date(str))
    .default(`${new Date()}`),
  updated_at: z
    .string()
    .transform((str) => new Date(str))
    .default(`${new Date()}`),
})

export const ManufacturePaginatedRequestSchema = PaginationQueriesSchema.extend(
  {
    name: z
      .string()
      .max(255, { message: "Name must not exceed 255 characters." })
      .optional(),
    type: z.preprocess(
      (value) => {
        if (typeof value === "string" && value.trim() !== "") {
          const parsed = parseInt(value, 10)
          return isNaN(parsed) ? undefined : parsed
        }

        return typeof value === "number" ? value : undefined
      },
      z
        .number()
        .int({ message: "Type must be an integer." })
        .nonnegative({ message: "Type must be a positive number." })
        .optional()
    ),
  }
)

export const ManufactureDetailRequestSchema = ManufactureSchema.pick({
  id: true,
})

/*
 * DTO - Request
 */
export type ManufactureSyncRequestDTO = z.infer<typeof ManufactureSyncSchema>

export type ManufacturePaginatedRequestDTO = z.infer<
  typeof ManufacturePaginatedRequestSchema
> & {
  ids?: number[]
  isPaginate?: boolean
}
