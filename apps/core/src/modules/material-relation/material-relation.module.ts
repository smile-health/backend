import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { MaterialRelationRepository } from "./material-relation.repository.js"
import { GetMaterialRelationsQueryParams } from "./material-relation.schema.js"

export class MaterialRelationModule {
  constructor(
    private readonly repo: MaterialRelationRepository
  ) { }

  async list(c: Context, queryParam: GetMaterialRelationsQueryParams) {
    const { data, total } = await this.repo.findAll(c, queryParam)

    if (data.length === 0) {
      return new PaginatedResponse(queryParam)
    }

    return new PaginatedResponse(queryParam, data, total)
  }
}
