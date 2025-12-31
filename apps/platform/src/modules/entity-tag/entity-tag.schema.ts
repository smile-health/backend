import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const GetListEntityTagSchema = PaginationQueriesSchema

export type GetEntityTagsQueries = z.infer<typeof GetListEntityTagSchema>
