import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { StockQualityRepository } from "./stock-quality.repository.js"
import { GetListStockQualityQueries } from "./stock-quality.schema.js"

export class StockQualityModule {
  constructor(private repository: StockQualityRepository) {}

  async list(c: Context, param: GetListStockQualityQueries) {
    const { list, total } = await this.repository.findListStockQuality(c, param)
    return new PaginatedResponse(param, list, total)
  }
}
