import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

export const GetListEntityUserSchema = PaginationQueriesSchema

export type GetEntitiesUsersQueries = z.infer<typeof GetListEntityUserSchema>
