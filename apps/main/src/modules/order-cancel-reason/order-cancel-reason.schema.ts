import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

const preprocessToString = (value: unknown) =>
  typeof value === "number" ? String(value) : value

/* Base Schema */
export const OrderCancelReason = z.object({
  id: z.number().positive(),
  name: z.preprocess(preprocessToString, z.string().min(1).max(255).nullish()),
  created_by: z.number().positive(),
  updated_by: z.number().positive(),
  deleted_by: z.number().positive().nullish(),
  created_at: z.date(),
  updated_at: z.date(),
  deleted_at: z.date().nullish(),
})

export const GetOrderReasonsQueryParamSchema = PaginationQueriesSchema

export type GetOrderReasonsQueryParam = z.infer<
  typeof GetOrderReasonsQueryParamSchema
>
