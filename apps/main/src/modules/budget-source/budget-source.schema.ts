import { STATUS } from "@/common/constants/general.js"
import { SourceMaterials } from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { Selectable } from "kysely"
import { z } from "zod"
import { UserResponse } from "../user/user.schema.js"

function fromStringToNumber(field?: string) {
  return z.preprocess(
    (value) =>
      value === null
        ? undefined
        : (() => {
            if (typeof value === "string") {
              return parseInt(value, 10)
            }
            return value
          })(),
    z
      .int()
      .nonnegative()
      .refine((v) => !isNaN(v))
  )
}

function stringMinMax(min?: number, max?: number) {
  // zod 4: .min(undefined) menolak semua input, jadi batas hanya dipasang kalau diisi.
  let schema = z.string()
  if (min !== undefined) schema = schema.min(min)
  if (max !== undefined) schema = schema.max(max)
  return schema
}

function positifNumber() {
  return z.int().nonnegative()
}

export const GeneralSchema = z.object({
  id: fromStringToNumber(),
  name: stringMinMax(1, 255),
  description: stringMinMax(0, 255).nullish(),
  created_by: positifNumber().nullish(),
  updated_by: positifNumber().nullish(),
})

export const BudgetSourceSyncSchema = GeneralSchema.extend({
  global_id: positifNumber().nullish(),
  workspace_ids: z.array(z.number()).nullish(),
  created_at: z
    .string()
    .transform((str) => new Date(str))
    .prefault(`${new Date()}`),
})

export const GetBudgetSourceQueriesSchema = PaginationQueriesSchema.extend({
  is_restricted: z
    .string()
    .refine((val) => !val || ["0", "1"].includes(val), {
      error: "is_restricted must be 0 or 1",
    })
    .transform((val) => Number(val))
    .optional(),
  sort_by: z.string().nullish().optional(),
  sort_type: z.string().nullish().optional(),
  status: z
    .string()
    .refine((val) => !val || ["0", "1"].includes(val), {
      error: "Status must be 0 or 1",
    })
    .transform((val) => Number(val))
    .optional(),
})

export const DetailSchema = GeneralSchema.pick({
  id: true,
})

export type BudgetSourceSyncRequest = z.infer<typeof BudgetSourceSyncSchema>

export type GetBudgetSourceQueries = z.infer<
  typeof GetBudgetSourceQueriesSchema
> & {
  ids?: number[]
  isPaginate?: boolean
}
export interface BudgetSourceResponse extends Selectable<SourceMaterials> {
  user_created_by?: Pick<UserResponse, "id" | "firstname" | "lastname">
  user_updated_by?: Pick<UserResponse, "id" | "firstname" | "lastname">
}

export interface TExportBudgetSource {
  name: string | null
  description: string | null
  is_restricted: string
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
  workspace?: string | null
}

export const UpdateStatusRequestSchema = z.object({
  status: z.enum(STATUS),
})
export type UpdateStatusRequest = z.infer<typeof UpdateStatusRequestSchema>
