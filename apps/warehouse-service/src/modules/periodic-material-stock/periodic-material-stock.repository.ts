import { Context } from "hono"
import { execQuery } from "@/common/infrastructure/database/index.js"
import {
  PeriodicMaterialStockQueryParams,
  MaterialQtyData,
} from "./periodic-material-stock.schema.js"
import { PeriodicMaterialStockQuery } from "./periodic-material-stock.query.js"
import moment from "moment"

export class PeriodicMaterialStockRepository {
  constructor(
    private readonly periodicMaterialStockQuery: PeriodicMaterialStockQuery
  ) {}

  async fetchMaterialCount(
    c: Context,
    queryParams: PeriodicMaterialStockQueryParams
  ): Promise<MaterialQtyData[]> {
    const query = this.periodicMaterialStockQuery.buildMaterialQtyQuery(
      c,
      queryParams
    )

    const currentDate = moment(queryParams.to).format("YYYY-MM-DD")

    const result = await execQuery<MaterialQtyData[]>(query, {
      ...queryParams,
      currentDate,
    })

    return result
  }

  async fetchLastUpdated(): Promise<{ last_updated: string } | null> {
    const query = this.periodicMaterialStockQuery.buildLastUpdatedQuery()

    const result = await execQuery<{ last_updated: string }[]>(query)

    return result[0] || null
  }
}
