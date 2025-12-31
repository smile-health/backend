import { SourceMaterials } from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { Selectable } from "kysely"
import { z } from "zod"
import { UserResponse } from "../user/user.schema.js"

function fromStringToNumber(field?: string) {
  return z.preprocess(
    (value) =>
      value === null
        ? undefined
        : typeof value === "string"
          ? parseInt(value, 10)
          : value,
    z
      .number()
      .int()
      .nonnegative()
      .refine((v) => !isNaN(v))
  )
}

function stringMinMax(min?: number, max?: number) {
  return z.string().min(min!).max(max!)
}

function positifNumber() {
  return z.number().int().nonnegative()
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
    .default(`${new Date()}`),
})

export const GetBudgetSourceQueriesSchema = PaginationQueriesSchema

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
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
  workspace?: string | null
}
