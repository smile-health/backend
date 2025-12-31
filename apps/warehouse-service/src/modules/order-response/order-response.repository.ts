import { Context } from "hono"
import { execQuery } from "@/common/infrastructure/database/index.js"
import {
  OrderResponseQueryParams,
  OrderResponseDataDTO,
} from "./order-response.schema.js"
import { OrderResponseQuery } from "./order-response.query.js"
import { UsedFor } from "@/common/schemas/query-param.schema.js"

export class OrderResponseRepository {
  constructor(private readonly orderResponseQuery: OrderResponseQuery) {}

  /**
   * Unified method to get order response data for all endpoints
   * @param c - Hono context
   * @param queryParams - Query parameters
   * @param endpointType - Type of endpoint: "review", "material", "entity", "location"
   */
  async fetchOrderResponseData(
    c: Context,
    queryParams: OrderResponseQueryParams,
    endpointType: UsedFor
  ): Promise<OrderResponseDataDTO[]> {
    const query = this.orderResponseQuery.buildOrderResponseQuery(
      c,
      queryParams,
      endpointType
    )

    const result = await execQuery<OrderResponseDataDTO[]>(query, queryParams)

    return result
  }

  /**
   * Get last updated timestamp
   */
  async fetchLastUpdated(): Promise<{ last_updated: string } | null> {
    const query = this.orderResponseQuery.buildLastUpdatedQuery()

    const result = await execQuery<{ last_updated: string }[]>(query)

    return result[0] || null
  }
}
