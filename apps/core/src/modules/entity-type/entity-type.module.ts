import { TEntityTypePageableRequest } from "./entity-type.schema.js"
import { EntityTypeRepository } from "./entity-type.repository.js"
import { Context } from "hono"

export class EntityTypeModule {
  constructor(private readonly repository: EntityTypeRepository) {}

  async getEntityTypePage(c: Context, param: TEntityTypePageableRequest) {
    return await this.repository.findAllPageable(c, param)
  }
}
