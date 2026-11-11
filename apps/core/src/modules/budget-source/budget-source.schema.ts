import { BudgetSources } from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import {
  isStringNumbers,
  transformStringNumbersToArrayNumbers,
} from "@smile-health/lib/utils.js"
import { Selectable } from "kysely"
import { z } from "zod"
import { TWorkspaces, UserResponse } from "../user/user.schema.js"

function fromStringToNumber() {
  return z.preprocess(
    (value) => {
      if (value === null) return undefined
      if (typeof value === "string") return parseInt(value, 10)
      return value
    },
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

function positiveNumber() {
  return z.int().nonnegative()
}

export const GeneralSchema = z.object({
  name: stringMinMax(1, 255),
  description: stringMinMax(0, 255).nullish(),
  created_by: z.number().nullish(),
  updated_by: z.number().nullish(),
  updated_at: z
    .string()
    .transform((str) => new Date(str))
    .nullish(),
  is_restricted: z.int(),
})

export const CreateBudgetSourceWorkspaceSchema = z.object({
  budget_source_id: positiveNumber(),
  workspace_id: positiveNumber(),
})

export const CreateSchema = GeneralSchema.extend({
  program_ids: z.array(z.number()).nullish(),
})

export const DetailSchema = z.object({
  id: fromStringToNumber(),
})

export const GetBudgetSourceQueriesSchema = PaginationQueriesSchema.extend({
  program_ids: z
    .string()
    .nullish()
    .refine((val) => !val || isStringNumbers(val))
    .transform((val) =>
      val ? transformStringNumbersToArrayNumbers(val) : null
    ),
  sort_by: z.string().nullish().optional(),
  sort_type: z.string().nullish().optional(),
})

export type CreateRequest = z.infer<typeof CreateSchema>
export type DetailRequest = z.infer<typeof DetailSchema>
export type CreateBudgetSourceWorkspaceRequest = z.infer<
  typeof CreateBudgetSourceWorkspaceSchema
>
export type BudgetSourceResponse = Selectable<BudgetSources> & {
  user_created_by?: Pick<UserResponse, "id" | "firstname" | "lastname">
  user_updated_by?: Pick<UserResponse, "id" | "firstname" | "lastname">
  programs?: TWorkspaces[]
}
export type GetBudgetSourceQueries = z.infer<
  typeof GetBudgetSourceQueriesSchema
> & {
  ids?: number[]
  isPaginate?: boolean
}
export interface TExportBudgetSource {
  id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
  program?: string | null
  is_restricted: string
}
