import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { EntityTagRepository } from "./entity-tag.repository.js"
import { GetEntityTagsQueries } from "./entity-tag.schema.js"

export class EntityTagModule {
  constructor(private entityTagRepo: EntityTagRepository) { }

  async list(c: Context, param: GetEntityTagsQueries) {
    const [listEntityTag, totalEntityTag] = await Promise.all([
      this.entityTagRepo.getListEntityTag(c, param),
      this.entityTagRepo.getTotalCountEntityTag(c, param),
    ])

    return new PaginatedResponse(param, listEntityTag, totalEntityTag)
  }
}
