import { Context } from "hono"
import { GetTypePQsQueryParams } from "./type-pqs.schema"
import { PaginatedResponse } from "@smile-health/lib/types/paginate"
import { TypePQsepository } from "./type-pqs.repository"

export class TypePQsModule {
  constructor(private readonly repository: TypePQsepository) {}

  async list(c: Context, queryParam: GetTypePQsQueryParams) {
    const { data, total } = await this.repository.findAll(c, queryParam)

    if (data.length === 0) {
      return new PaginatedResponse(queryParam)
    }

    return new PaginatedResponse(queryParam, data, total)
  }
}
