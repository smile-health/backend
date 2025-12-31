import { SORT_TYPE, STATUS } from "@/common/constants/general.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { z } from "zod"

/*
 * Schema
 */
const preprocessNumber = (value: unknown) => {
  if (value === null || value === "") return undefined
  if (typeof value === "string") return parseInt(value, 10)
  if (typeof value === "number") return value
  return undefined
}
const PositiveIntSchema = z.number().int().positive()
const statusSchema = z.nativeEnum(STATUS)

/*
 * Validation Rules
 */
const ManufactureSchema = z.object({
  id: z.preprocess(preprocessNumber, z.number().int().nonnegative()),
})

/*
 * Use Case - Request
 */
export const ManufacturePaginatedRequestSchema = PaginationQueriesSchema.extend(
  {
    type: z.preprocess(preprocessNumber, PositiveIntSchema.optional()),
    status: z.preprocess(preprocessNumber, statusSchema.optional()),
    material_id: z.preprocess(preprocessNumber, PositiveIntSchema.optional()),
    sort_by: z.string().optional(),
    sort_type: z.nativeEnum(SORT_TYPE).optional(),
    is_temperature_sensitive: z.preprocess(
      (v) => (v === "0" || v === 0 ? 0 : v === "1" || v === 1 ? 1 : v),
      z.union([z.literal(0), z.literal(1)]).optional()
    ),
  }
)

export const ManufactureDetailRequestSchema = ManufactureSchema

/*
 * DTO - Request
 */
export type ManufacturePaginatedRequestDTO = z.infer<
  typeof ManufacturePaginatedRequestSchema
> & {
  ids?: number[]
  isPaginate?: boolean
}

export type ManufactureDetailRequestDTO = z.infer<
  typeof ManufactureDetailRequestSchema
>

export const UpdateStatusRequestSchema = z.object({
  status: statusSchema,
})

export type UpdateStatusRequest = z.infer<typeof UpdateStatusRequestSchema>
