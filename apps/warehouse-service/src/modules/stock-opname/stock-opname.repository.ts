import { Context } from "hono"
import {
  StockOpnameComplianceDTO,
  StockOpnameQueryParams,
  StockOpnameResultDTO,
  StockOpnameMaterialDTO,
} from "./stock-opname.schema.js"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { StockOpnameQuery } from "./stock-opname.query.js"
import { PaginationOption } from "@/common/schemas/pagination.schema.js"

export class StockOpnameRepository {
  constructor(private readonly stockOpnameQuery: StockOpnameQuery) {}

  async fetchSoCompliance(
    c: Context,
    queryParams: StockOpnameQueryParams,
    isSummaryBox: boolean
  ) {
    const stockOpnameComplianceQuery =
      this.stockOpnameQuery.buildStockOpnameComplianceQuery(
        c,
        queryParams,
        isSummaryBox
      )

    return await execQuery<StockOpnameComplianceDTO>(
      stockOpnameComplianceQuery,
      queryParams
    )
  }

  async fetchTotalSoCompliance(
    c: Context,
    queryParams: StockOpnameQueryParams,
    isSummaryBox: boolean
  ) {
    const totalSoComplianceQuery =
      this.stockOpnameQuery.buildTotalStockOpnameComplianceQuery(
        c,
        queryParams,
        isSummaryBox
      )

    return await execQuery<StockOpnameComplianceDTO>(
      totalSoComplianceQuery,
      queryParams
    )
  }

  async fetchSoResult(
    c: Context,
    queryParams: StockOpnameQueryParams,
    isSummaryBox: boolean,
    { is_paginate = true, count = false }: PaginationOption = {}
  ): Promise<StockOpnameResultDTO | number> {
    const stockOpnameResultQuery =
      this.stockOpnameQuery.buildStockOpnameResultQuery(
        c,
        queryParams,
        isSummaryBox,
        is_paginate
      )

    const records = await execQuery<StockOpnameResultDTO>(
      stockOpnameResultQuery,
      queryParams
    )

    if (count) {
      return records && records.length > 0 ? records.length : 0
    }

    return records
  }

  async fetchSoMaterial(c: Context, queryParams: StockOpnameQueryParams) {
    const stockOpnameMaterialQuery =
      this.stockOpnameQuery.buildStockOpnameMaterialQuery(c, queryParams)

    return await execQuery<StockOpnameMaterialDTO>(
      stockOpnameMaterialQuery,
      queryParams
    )
  }
}
