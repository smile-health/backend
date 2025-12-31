import { PaginationOption } from "@/common/schemas/pagination.schema.js"
import { ActivityQueryParams } from "./activity.schema.js"
import { Context } from "hono"

export class ActivityQuery {
  constructor() {}

  #generateActivityClauses(
    queryParams: ActivityQueryParams,
    paginationOption: PaginationOption
  ) {
    const { paginate, offset } = queryParams
    const { is_paginate, count } = paginationOption

    let pagination = ""
    let select = ""
    let orderBy = ""
    if (count === true) {
      pagination = ""
      select = "COUNT(DISTINCT rwa.id) as count"
    } else if (is_paginate === false && count === false) {
      pagination = ""
      select = `
        rwa.id as id, 
        rwa.name as name, 
        rwa.code as code
      `
      orderBy = "ORDER BY rwa.id ASC"
    } else {
      pagination = `LIMIT ${paginate} OFFSET ${offset}`
      select = `
        rwa.id as id, 
        rwa.name as name, 
        rwa.code as code
      `
      orderBy = "ORDER BY rwa.id ASC"
    }

    return { pagination, select, orderBy }
  }

  #generateActivityFilters(queryParams: ActivityQueryParams) {
    const { name, code, activity_id } = queryParams

    let filters = ""
    filters += activity_id ? " AND rwa.id = {activity_id:Int64}" : ""
    filters += name ? " AND rwa.name ILIKE {name:String}" : ""
    filters += code ? " AND rwa.code ILIKE {code:String}" : ""

    return { filters }
  }

  buildActivityQuery(
    c: Context,
    queryParams: ActivityQueryParams,
    paginationOption: PaginationOption
  ) {
    const programId = c.var.programId

    const { pagination, select, orderBy } = this.#generateActivityClauses(
      queryParams,
      paginationOption
    )

    const { filters } = this.#generateActivityFilters(queryParams)

    const query = `
      SELECT 
        ${select}
      FROM raw_ws_activities AS rwa FINAL
      PREWHERE rwa.program_id = ${programId}
      WHERE
        rwa.deleted_at is null
        ${filters}
      ${orderBy}
      ${pagination}
    `

    return query
  }
}
