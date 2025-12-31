import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { EntityTagQueryParams } from "./entity-tag.schema.js"
import { Context } from "hono"

export class EntityTagQuery {
  constructor() {}

  #generateEntityTagClauses(
    queryParams: EntityTagQueryParams,
    paginationOption: PaginationOption
  ) {
    const { paginate, offset } = queryParams
    const { is_paginate, count } = paginationOption

    let pagination = ""
    let select = ""
    let orderBy = ""
    if (count === true) {
      pagination = ""
      select = "COUNT(DISTINCT ret.id) as count"
    } else if (is_paginate === false && count === false) {
      pagination = ""
      select = "ret.id as id, ret.title as title"
      orderBy = "ORDER BY ret.id ASC"
    } else {
      pagination = `LIMIT ${paginate} OFFSET ${offset}`
      select = "ret.id as id, ret.title as title"
      orderBy = "ORDER BY ret.id ASC"
    }

    return { pagination, select, orderBy }
  }

  #generateEntityTagFilters(queryParams: EntityTagQueryParams) {
    const { entity_tag_id, entity_tag_ids } = queryParams

    let filters = ""
    filters += entity_tag_id ? " AND ret.id = {entity_tag_id:Int64}" : ""
    filters += entity_tag_ids
      ? " AND ret.id in {entity_tag_ids:Array(Int64)}"
      : ""

    return { filters }
  }

  buildEntityTagQuery(
    c: Context,
    queryParams: EntityTagQueryParams,
    paginationOption: PaginationOption
  ) {
    const { pagination, select, orderBy } = this.#generateEntityTagClauses(
      queryParams,
      paginationOption
    )

    const { filters } = this.#generateEntityTagFilters(queryParams)

    const query = `
      SELECT
        ${select}
      FROM raw_entity_tags AS ret FINAL
      WHERE
        ret.deleted_at is null
        ${filters}
      ${orderBy}
      ${pagination} 
    `

    return query
  }
}
