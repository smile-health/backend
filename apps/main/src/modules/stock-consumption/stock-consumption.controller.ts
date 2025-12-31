import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { StockConsumptionModule } from "./stock-consumption.module.js"
import {
  GetListStockConsumptionSchema,
  GetDetailStockConsumptionSchema,
} from "./stock-consumption.schema.js"

export class StockConsumptionController extends BaseController {
  constructor(private module: StockConsumptionModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/",
      this.validateRequest("query", GetListStockConsumptionSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    router.get(
      "/detail",
      this.validateRequest("query", GetDetailStockConsumptionSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.detail(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
