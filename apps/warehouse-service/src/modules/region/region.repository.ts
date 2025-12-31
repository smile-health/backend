import { Context } from "hono"
import { RegionDTO, RegionQueryParams } from "./region.schema.js"
import { LOCATION_LEVEL } from "@/common/constants/location.js"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { RegionQuery } from "./region.query.js"
import {
  CountDTO,
  PaginationOption,
} from "@/common/schemas/pagination.schema.js"

export class RegionRepository {
  constructor(private readonly regionQuery: RegionQuery) {}

  async fetchProvinces(
    c: Context,
    queryParams: RegionQueryParams,
    { is_paginate = true }: PaginationOption = {}
  ): Promise<{ records: RegionDTO; count: number }> {
    const query = this.regionQuery.buildRegionQuery(
      queryParams,
      LOCATION_LEVEL.PROVINCE,
      { is_paginate, count: false }
    )
    const countQuery = this.regionQuery.buildRegionQuery(
      queryParams,
      LOCATION_LEVEL.PROVINCE,
      { is_paginate: false, count: true }
    )

    const records = await execQuery<RegionDTO>(query, queryParams)
    const count = await execQuery<CountDTO>(countQuery, queryParams)

    return { records, count: count[0]!.count ?? 0 }
  }

  async fetchRegencies(
    c: Context,
    queryParams: RegionQueryParams,
    { is_paginate = true }: PaginationOption = {}
  ): Promise<{ records: RegionDTO; count: number }> {
    const query = this.regionQuery.buildRegionQuery(
      queryParams,
      LOCATION_LEVEL.REGENCY,
      { is_paginate, count: false }
    )
    const countQuery = this.regionQuery.buildRegionQuery(
      queryParams,
      LOCATION_LEVEL.REGENCY,
      { is_paginate: false, count: true }
    )

    const records = await execQuery<RegionDTO>(query, queryParams)
    const count = await execQuery<CountDTO>(countQuery, queryParams)

    return { records, count: count[0]!.count ?? 0 }
  }
}
