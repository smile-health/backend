import { Context } from "hono"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { StockInventoryQuery } from "./stock-inventory.query.js"
import {
  StockInventoryBaseQueryParams,
  StockInventoryData,
  TransactionType,
} from "./stock-inventory.schema.js"

/**
 * Shared repository for stock inventory modules
 * Used by both stock-availability and abnormal-stock modules
 */
export class StockInventoryRepository {
  constructor(private readonly query: StockInventoryQuery) {}

  /**
   * Unified method to fetch stock inventory data
   * Used by both modules for all endpoints
   *
   * @param c - Hono context
   * @param queryParams - Query parameters including optional transactionType
   * @param transactionType - Transaction type
   */
  async fetchStockInventoryData(
    c: Context,
    queryParams: StockInventoryBaseQueryParams & { transactionType?: string },
    transactionType: TransactionType
  ): Promise<StockInventoryData[]> {
    const query = this.query.buildStockInventoryQuery(
      c,
      queryParams,
      transactionType
    )
    const result = await execQuery<StockInventoryData[]>(query, queryParams)
    return result
  }

  /**
   * Get last updated timestamp
   * Shared between both modules
   */
  async getLastUpdated(): Promise<string> {
    const query = this.query.getLastUpdatedQuery()
    const result = await execQuery<{ last_updated: string }[]>(query)
    return result[0]!.last_updated
  }
}
