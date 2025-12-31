import { Context } from "hono"
import { EntityDTO, EntityQueryParams } from "./entity.schema.js"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { EntityQuery } from "./entity.query.js"
import {
  CountDTO,
  PaginationOption,
} from "@/common/schemas/pagination.schema.js"

export class EntityRepository {
  constructor(private readonly entityQuery: EntityQuery) {}

  async fetchEntities(
    c: Context,
    queryParams: EntityQueryParams,
    { is_paginate = true }: PaginationOption = {}
  ): Promise<{ records: EntityDTO; count: number }> {
    const query = this.entityQuery.buildEntityQuery(c, queryParams, {
      is_paginate,
      count: false,
    })
    const countQuery = this.entityQuery.buildEntityQuery(c, queryParams, {
      is_paginate: false,
      count: true,
    })

    const records = await execQuery<EntityDTO>(query, queryParams)
    const count = await execQuery<CountDTO>(countQuery, queryParams)

    return { records, count: count[0]!.count ?? 0 }
  }
}
