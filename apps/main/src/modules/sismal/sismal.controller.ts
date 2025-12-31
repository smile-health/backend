import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { SismalModule } from "./sismal.module.js"
import {
  SismalOrdersQueries,
  SismalTransactionsQueries,
} from "./sismal.schema.js"

export class SismalController extends BaseController {
  constructor(private readonly module: SismalModule) {
    super()
  }

  public getRoutes(): Hono {
    const app = new Hono()

    app.get(
      "/transactions",
      this.validateRequest("query", SismalTransactionsQueries),
      async (c) => {
        const params = c.req.valid("query")
        const result = await this.module.getAllTransactions(c, params)
        return c.json(result, StatusCodes.OK)
      }
    )

    app.get(
      "/orders",
      this.validateRequest("query", SismalOrdersQueries),
      async (c) => {
        const params = c.req.valid("query")
        const result = await this.module.getAllOrders(c, params)
        return c.json(result, StatusCodes.OK)
      }
    )

    return app
  }
}
