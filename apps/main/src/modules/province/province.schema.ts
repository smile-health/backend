import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const GetListProvinceSchema = PaginationQueriesSchema

export type GetProvincesQueries = z.infer<typeof GetListProvinceSchema>
