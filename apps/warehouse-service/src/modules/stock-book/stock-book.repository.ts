import { Context } from "hono"
import {
  EntityMaterialActivityDTO,
  StockBookDTO,
  StockBookQueryParams,
} from "./stock-book.schema.js"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { StockBookQuery } from "./stock-book.query.js"

export class StockBookRepository {
  constructor(private readonly stockBookQuery: StockBookQuery) {}

  async fetchStockBook(
    c: Context,
    queryParams: StockBookQueryParams
  ): Promise<StockBookDTO> {
    const query = this.stockBookQuery.buildStockBookQuery(c, queryParams)

    return await execQuery<StockBookDTO>(query, queryParams)
  }

  async fetchEntityMaterialActivity(
    c: Context,
    queryParams: StockBookQueryParams
  ): Promise<EntityMaterialActivityDTO> {
    const query = this.stockBookQuery.buildEntityMaterialActivityQuery(
      c,
      queryParams
    )

    return await execQuery<EntityMaterialActivityDTO>(query, queryParams)
  }
}
