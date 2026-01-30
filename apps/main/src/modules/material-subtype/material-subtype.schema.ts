import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import z from "zod"

/**
 * Get list
 */
export const GetListMaterialSubtypeSchema = PaginationQueriesSchema.extend({
  subtype_id: z.coerce.number().optional(),
})
export type GetListMaterialSubtypeQueries = z.infer<
  typeof GetListMaterialSubtypeSchema
>

/**
 * Material subtype item
 */
export const MaterialSubtypeItemSchema = z.object({
  subtype_id: z.number(),
  subtype_name: z.string(),
})
export type MaterialSubtypeItem = z.infer<typeof MaterialSubtypeItemSchema>
