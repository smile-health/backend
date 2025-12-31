import { Context } from "hono"
import { EntityTagRepository } from "./entity-tag.repository.js"
import { GetEntityTagsQueries } from "./entity-tag.schema.js"

export class EntityTagModule {
  constructor(private readonly entityTagRepo: EntityTagRepository) {}

  async list(c: Context, param: GetEntityTagsQueries) {
    return await this.entityTagRepo.findAll(c, param)
  }
}
