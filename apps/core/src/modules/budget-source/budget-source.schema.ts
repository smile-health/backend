import { BudgetSources } from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import {
  isStringNumbers,
  transformStringNumbersToArrayNumbers,
} from "@smile/lib/utils.js"
import { Selectable } from "kysely"
import z from "zod"
import { TWorkspaces, UserResponse } from "../user/user.schema.js"

function fromStringToNumber() {
  return z.preprocess(
    (value) => {
      if (value === null) return undefined
      if (typeof value === "string") return parseInt(value, 10)
      return value
    },
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

function positiveNumber() {
  return z.number().int().nonnegative()
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
  is_restricted: z.number().int(),
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
