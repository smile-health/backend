import z from "zod"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"

const preprocessToString = (value: unknown) =>
  typeof value === "number" ? String(value) : value

/* Base Schema */
export const DisposalMethod = z.object({
  id: z.number().positive(),
  title: z.preprocess(preprocessToString, z.string().min(1).max(255)),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().positive().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

export const GetDisposalMethodsQueryParamSchema = PaginationQueriesSchema

export type GetDisposalMethodsQueryParam = z.infer<
  typeof GetDisposalMethodsQueryParamSchema
>

export type DisposalMethodResponse = {
  id: number
  title: string
}
