import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const GetListEntityTypeSchema = PaginationQueriesSchema

export type GetEntityTypesQueries = z.infer<typeof GetListEntityTypeSchema>
