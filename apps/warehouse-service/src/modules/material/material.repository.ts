import { Context } from "hono"
import {
  MaterialDTO,
  MaterialQueryParams,
  MaterialEntityQueryParams,
  SoMaterialDenomDTO,
} from "./material.schema.js"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { MaterialQuery } from "./material.query.js"
import {
  CountDTO,
  PaginationOption,
} from "@/common/schemas/pagination.schema.js"

export class MaterialRepository {
  constructor(private readonly materialQuery: MaterialQuery) {}

  async fetchMaterials(
    c: Context,
    queryParams: MaterialQueryParams,
    { is_paginate = true }: PaginationOption = {}
  ): Promise<{ records: MaterialDTO; count: number }> {
    const query = this.materialQuery.buildMaterialQuery(c, queryParams, {
      is_paginate,
      count: false,
    })
    const countQuery = this.materialQuery.buildMaterialQuery(c, queryParams, {
      is_paginate: false,
      count: true,
    })

    const records = await execQuery<MaterialDTO>(query, queryParams)
    const count = await execQuery<CountDTO>(countQuery, queryParams)

    return { records, count: count[0]!.count ?? 0 }
  }

  async fetchSoDenomMaterials(c: Context, queryParams: MaterialQueryParams) {
    const query = this.materialQuery.buildSoMaterialDenomQuery(c, queryParams)
    return await execQuery<SoMaterialDenomDTO>(query, queryParams)
  }

  async fetchMaterialEntities(
    c: Context,
    queryParams: MaterialEntityQueryParams,
    { is_paginate = true }: PaginationOption = {}
  ): Promise<{ records: MaterialDTO; count: number }> {
    const query = this.materialQuery.buildMaterialEntitiesQuery(
      c,
      queryParams,
      {
        is_paginate,
        count: false,
      }
    )
    const countQuery = this.materialQuery.buildMaterialEntitiesQuery(
      c,
      queryParams,
      {
        is_paginate: false,
        count: true,
      }
    )

    const records = await execQuery<MaterialDTO>(query, queryParams)
    const count = await execQuery<CountDTO>(countQuery, queryParams)

    return { records, count: count[0]!.count ?? 0 }
  }
}
