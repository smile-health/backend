import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export type ResponseListAdditional = {
  id: number
  title: string
  created_by: number | null
  updated_by: number | null
  deleted_by: number | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
}

export type ResponseListAdditionalDTO = ResponseListAdditional & {
  reconciliation_action_id?: number | null
  reconciliation_reason_id?: number | null
}

export type ResponseAdditional = {
  count: string | number | bigint
  list: ResponseListAdditional[]
}

export const GetListAdditionalSchema = PaginationQueriesSchema

export type GetAdditionalQueries = z.infer<typeof GetListAdditionalSchema>
