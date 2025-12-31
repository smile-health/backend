import { LOCATION_LEVEL } from "@/common/constants/location.js"
import { RegionQueryParams } from "./region.schema.js"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"

export class RegionQuery {
  constructor() {}

  #generrateRegionClauses(
    queryParams: RegionQueryParams,
    regionLevel: number,
    paginationOption: PaginationOption
  ) {
    const { paginate, offset } = queryParams
    const { is_paginate, count } = paginationOption

    let pagination = ""
    let select = ""
    let orderBy = ""
    if (count === true) {
      pagination = ""
      select = "COUNT(DISTINCT rl.id) as count"
    } else if (is_paginate === false && count === false) {
      pagination = ""
      select = `
        rl.id as id, 
        rl.name as name, 
        ${regionLevel} as type
      `
      orderBy = "ORDER BY rl.id ASC"
    } else {
      pagination = `LIMIT ${paginate} OFFSET ${offset}`
      select = `
        rl.id as id, 
        rl.name as name, 
        ${regionLevel} as type
      `
      orderBy = "ORDER BY rl.id ASC"
    }

    return { pagination, select, orderBy }
  }

  #generateRegionFilters(queryParams: RegionQueryParams, regionLevel: number) {
    const { province_id, province_ids, regency_id, regency_ids } = queryParams

    let filters = ""
    if (regionLevel === LOCATION_LEVEL.PROVINCE) {
      filters += province_id ? " AND rl.id = {province_id:Int64}" : ""
      filters += province_ids ? " AND rl.id in {province_ids:Array(Int64)}" : ""
    } else if (regionLevel === LOCATION_LEVEL.REGENCY) {
      filters += province_id ? " AND rl.parent_id = {province_id:Int64}" : ""
      filters += province_ids
        ? " AND rl.parent_id in {province_ids:Array(Int64)}"
        : ""
      filters += regency_id ? " AND rl.id = {regency_id:Int64}" : ""
      filters += regency_ids ? " AND rl.id in {regency_ids:Array(Int64)}" : ""
    }

    return { filters }
  }

  buildRegionQuery(
    queryParams: RegionQueryParams,
    regionLevel: number,
    paginationOption: PaginationOption
  ) {
    const { filters } = this.#generateRegionFilters(queryParams, regionLevel)

    const { pagination, select, orderBy } = this.#generrateRegionClauses(
      queryParams,
      regionLevel,
      paginationOption
    )

    const query = `
      SELECT
        ${select}
      FROM raw_locations AS rl FINAL
      WHERE 
        rl.level = ${regionLevel}
        ${filters}
      ${orderBy}
      ${pagination}
    `

    return query
  }
}
