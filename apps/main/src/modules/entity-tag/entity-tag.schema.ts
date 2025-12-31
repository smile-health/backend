import { EntityTags } from "@/common/infrastructure/database/types/db.js"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { Selectable } from "kysely"
import z from "zod"

export const GetListEntityTagSchema = PaginationQueriesSchema

export type GetEntityTagsQueries = z.infer<typeof GetListEntityTagSchema>

export type EntityTagsDTO = Selectable<EntityTags>