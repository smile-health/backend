import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetListGroupTargetSchema = PaginationQueriesSchema.extend({
  keyword: z.string().optional(),
})

export const SubmitGroupTargetSchema = z.array(z.number().positive())

export const GetListGroupTargetParamsSchema = z.object({
  id: z.string({ required_error: "id is required" }),
  year: z.string({ required_error: "year is required" }),
})

export const DeleteGroupTargetParamsSchema = z.object({
  id: z.string({ required_error: "id is required" }),
  group_id: z.string({ required_error: "group id is required" }),
})

export type GetListGroupTargetQueries = z.infer<typeof GetListGroupTargetSchema>
export type SubmitGroupTargetRequest = z.infer<typeof SubmitGroupTargetSchema>
