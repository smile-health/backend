import { PaginationQueriesSchema } from "@smile-health/lib/types/paginate.js"
import { EntityTags } from "@/common/infrastructure/database/types/db.js"
import { Selectable } from "kysely"
import z from "zod"

export const EntityTagDto = z.object({
  id: z.number().optional(),
  title: z.string().optional(),
})

export const EntityTagDtos = z.array(EntityTagDto)

export const EntityTagPageableRequest = PaginationQueriesSchema

export type TEntityTagPageableRequest = z.infer<typeof PaginationQueriesSchema>
export type TEntityTagResponse = z.infer<typeof EntityTagDto>
export type TEntityTag = Selectable<EntityTags>
