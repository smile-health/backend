import { Context } from "hono"
import { execQuery } from "@/common/infrastructure/database/index.js"
import {
  OrderDifferenceQueryParams,
  OrderDifferenceDataDTO,
  OrderDifferenceLastUpdatedDTO,
} from "./order-difference.schema.js"
import { OrderDifferenceQuery } from "./order-difference.query.js"
import { UsedFor } from "@/common/schemas/query-param.schema.js"

export class OrderDifferenceRepository {
  constructor(private readonly orderDifferenceQuery: OrderDifferenceQuery) {}

  /**
   * Unified method to get order difference data
   * @param c - Hono context
   * @param queryParams - Query parameters
   * @param usedFor - Used for material, entity, all, or location
   */
  async fetchOrderDifferenceData(
    c: Context,
    queryParams: OrderDifferenceQueryParams,
    usedFor: UsedFor
  ): Promise<OrderDifferenceDataDTO[]> {
    const query = this.orderDifferenceQuery.buildOrderDifferenceQuery(
      c,
      queryParams,
      usedFor
    )

    const result = await execQuery<OrderDifferenceDataDTO[]>(query, queryParams)
    return result
  }

  /**
   * Get last updated timestamp
   */
  async fetchLastUpdated(): Promise<{ last_updated: string } | null> {
    const query = this.orderDifferenceQuery.buildLastUpdatedQuery()

    const result = await execQuery<OrderDifferenceLastUpdatedDTO[]>(query)
    return result[0] || null
  }
}
