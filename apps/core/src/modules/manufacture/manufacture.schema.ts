import { SORT_TYPE, STATUS } from "@/common/constants/general.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
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
export const ManufactureSchema = z.object({
  id: z.preprocess(preprocessNumber, PositiveIntSchema),
  name: z.string().min(1).max(255),
  type: z.preprocess(preprocessNumber, PositiveIntSchema),
  description: z.string().max(255).nullable(),
  contact_name: z.string().max(255).nullable(),
  phone_number: z
    .union([
      z
        .string()
        .max(15)
        .regex(/^\+[1-9]\d{1,14}$/),
      z.literal(""),
    ])
    .nullable(),
  email: z.union([z.string().email().max(255), z.literal("")]).nullable(),
  address: z.string().max(255).nullable(),
  status: statusSchema.optional(),
  created_by: PositiveIntSchema.optional(),
  updated_by: PositiveIntSchema.optional(),
  program_id: z.union([
    z.string().refine((val) => val.includes(";")),
    PositiveIntSchema,
  ]),
  program_ids: z.array(PositiveIntSchema),
})

/*
 * Use Case - Request
 */
export const ManufactureCreateRequestSchema = ManufactureSchema.omit({
  id: true,
  program_id: true,
})

export const ManufactureWorkspaceCreateRequestSchema = z.object({
  manufacture_id: z.number().positive(),
  workspace_id: z.number().positive(),
})

export const ManufacturePaginatedRequestSchema = PaginationQueriesSchema.extend(
  {
    type: z.preprocess(preprocessNumber, PositiveIntSchema.optional()),
    status: z.preprocess(preprocessNumber, statusSchema.optional()),
    program_ids: z
      .string()
      .transform((val) =>
        val.trim() === ""
          ? []
          : val
              .split(",")
              .map((s) => s.trim())
              .map((s) => Number(s))
              .filter((num) => !isNaN(num))
      )
      .optional(),
    sort_by: z.string().optional(),
    sort_type: z.nativeEnum(SORT_TYPE).optional(),
  }
)

export const ManufactureDetailRequestSchema = ManufactureSchema.pick({
  id: true,
})

export const ManufactureUpdateRequestSchema = ManufactureSchema.omit({
  id: true,
  created_by: true,
  program_id: true,
}).partial()

export const ManufactureImportRequestSchema = ManufactureSchema.omit({
  id: true,
  program_ids: true,
}).partial()

/*
 * DTO - Request
 */
export type ManufactureCreateRequestDTO = z.infer<
  typeof ManufactureCreateRequestSchema
>
export type ManufactureWorkspaceCreateRequestDTO = z.infer<
  typeof ManufactureWorkspaceCreateRequestSchema
>
export type ManufacturePaginatedRequestDTO = z.infer<
  typeof ManufacturePaginatedRequestSchema
> & {
  ids?: number[]
  isPaginate?: boolean
}
export type ManufactureDetailRequestDTO = z.infer<
  typeof ManufactureDetailRequestSchema
>
export type ManufactureUpdateRequestDTO = z.infer<
  typeof ManufactureUpdateRequestSchema
>
export type ManufactureImportRequestDTO = z.infer<
  typeof ManufactureImportRequestSchema
>
