import { Context } from "hono"
import { EntityTypeRepository } from "./entity-type.repository.js"
import { GetEntityTypesQueries } from "./entity-type.schema.js"

export class EntityTypeModule {
  constructor(private readonly entityType: EntityTypeRepository) {}

  async list(c: Context, param: GetEntityTypesQueries) {
    return await this.entityType.findAll(c, param)
  }
}
