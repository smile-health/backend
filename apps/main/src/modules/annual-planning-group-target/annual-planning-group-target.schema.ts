import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { z } from "zod"

export const GetListGroupTargetSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
})

export const SubmitGroupTargetSchema = z.array(z.number().positive())

export const GetListGroupTargetParamsSchema = z.object({
  id: z.string({
    error: (issue) =>
      issue.input === undefined ? "id is required" : undefined,
  }),
  year: z.string({
    error: (issue) =>
      issue.input === undefined ? "year is required" : undefined,
  }),
})

export const DeleteGroupTargetParamsSchema = z.object({
  id: z.string({
    error: (issue) =>
      issue.input === undefined ? "id is required" : undefined,
  }),
  group_id: z.string({
    error: (issue) =>
      issue.input === undefined ? "group id is required" : undefined,
  }),
})

export type GetListGroupTargetQueries = z.infer<typeof GetListGroupTargetSchema>
export type SubmitGroupTargetRequest = z.infer<typeof SubmitGroupTargetSchema>
