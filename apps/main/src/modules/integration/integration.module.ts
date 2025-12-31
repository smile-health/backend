import { Context } from "hono"

import { type z } from "zod"
import { IntegrationRepository } from "./integration.repository.js"
import StockOpnameRepository from "../stock-opname/stock-opname.repository.js"
import { GetStockOpnamesQueries } from "./integration.schema.js"

type StockOpnamesQueries = z.infer<typeof GetStockOpnamesQueries>

export class IntegrationModule {
  // constructor(private readonly repository: StockLoggingRepository) {}

  constructor(
    private readonly integration: IntegrationRepository,
    private readonly stockOpname: StockOpnameRepository
  ) {}

  async getStockOpnameNew(c: Context, params: any) {
    const result = await this.integration.findAll(c, params)
    return result
  }

  async getTransactionNew(c: Context, params: any) {
    const result = await this.integration.findAllTransactions(c, params)
    return result
  }
}
