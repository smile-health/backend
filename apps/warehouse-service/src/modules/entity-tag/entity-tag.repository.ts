import { Context } from "hono"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { EntityTagQuery } from "./entity-tag.query.js"
import { EntityTagDTO, EntityTagQueryParams } from "./entity-tag.schema.js"
import {
  CountDTO,
  PaginationOption,
} from "@/common/schemas/pagination.schema.js"

export class EntityTagRepository {
  constructor(private readonly entityTagQuery: EntityTagQuery) {}

  async fetchEntityTags(
    c: Context,
    queryParams: EntityTagQueryParams,
    { is_paginate = true }: PaginationOption = {}
  ): Promise<{ records: EntityTagDTO; count: number }> {
    const query = this.entityTagQuery.buildEntityTagQuery(c, queryParams, {
      is_paginate,
      count: false,
    })
    const countQuery = this.entityTagQuery.buildEntityTagQuery(c, queryParams, {
      is_paginate: false,
      count: true,
    })

    const records = await execQuery<EntityTagDTO>(query, queryParams)
    const count = await execQuery<CountDTO>(countQuery, queryParams)

    return { records, count: count[0]!.count ?? 0 }
  }
}
