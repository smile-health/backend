import { Context } from "hono"
import { EntityTagRepository } from "./entity-tag.repository.js"
import {
  TEntityTagPageableRequest,
} from "@/modules/entity-tag/entity-tag.schema.js"

export class EntityTagModule {
  constructor(private readonly repository: EntityTagRepository) {}

  async getEntityTags(c: Context, param: TEntityTagPageableRequest) {
    return await this.repository.findAll(c, param)
  }
}
