import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import z from "zod"

export const EntityTypeDto = z.object({
  id: z.number(),
  name: z.string(),
})

export const EntityTypeDtos = z.array(EntityTypeDto)

export const EntityTypePageableRequest = PaginationQueriesSchema

export type TEntityTypePageableRequest = z.infer<typeof PaginationQueriesSchema>
export type TEntityTypeResponse = z.infer<typeof EntityTypeDto>
