import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const GetListEntityVendorSchema = PaginationQueriesSchema

export type GetEntitiesVendorsQueries = z.infer<
  typeof GetListEntityVendorSchema
>
