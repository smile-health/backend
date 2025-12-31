import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { StockQualityModule } from "./stock-quality.module.js"
import { getListStockQualitySchema } from "./stock-quality.schema.js"

export class StockQualityController extends BaseController {
  constructor(private module: StockQualityModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/",
      this.validateRequest("query", getListStockQualitySchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        if (res.total_item === 0) return c.body(null, StatusCodes.NO_CONTENT)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
