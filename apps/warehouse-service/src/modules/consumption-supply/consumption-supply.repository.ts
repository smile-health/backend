import { Context } from "hono"
import { execQuery } from "@/common/infrastructure/database/index.js"
import {
  ConsumptionSupplyQueryParams,
  ConsumptionSupplyDataDTO,
  ConsumptionSupplyLastUpdatedDTO,
} from "./consumption-supply.schema.js"
import { ConsumptionSupplyQuery } from "./consumption-supply.query.js"
import { UsedFor } from "@/common/schemas/query-param.schema.js"

export class ConsumptionSupplyRepository {
  constructor(
    private readonly consumptionSupplyQuery: ConsumptionSupplyQuery
  ) {}

  /**
   * Unified method to get consumption supply data
   * @param c - Hono context
   * @param queryParams - Query parameters
   * @param usedFor - query condition
   */
  async fetchConsumptionSupplyData(
    c: Context,
    queryParams: ConsumptionSupplyQueryParams,
    usedFor: UsedFor
  ): Promise<ConsumptionSupplyDataDTO[]> {
    const query = this.consumptionSupplyQuery.buildConsumptionSupplyQuery(
      c,
      queryParams,
      usedFor
    )

    const result = await execQuery<ConsumptionSupplyDataDTO[]>(
      query,
      queryParams
    )
    return result
  }

  /**
   * Get last updated timestamp
   */
  async fetchLastUpdated(): Promise<{ last_updated: string } | null> {
    const query = this.consumptionSupplyQuery.buildLastUpdatedQuery()

    const result = await execQuery<ConsumptionSupplyLastUpdatedDTO[]>(query)
    return result[0] || null
  }
}
