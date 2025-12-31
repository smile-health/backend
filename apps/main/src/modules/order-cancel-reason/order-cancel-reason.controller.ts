import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { OrderCancelReasonModule } from "./order-cancel-reason.module.js"
import { GetOrderReasonsQueryParamSchema } from "./order-cancel-reason.schema.js"

export class OrderCancelReasonController extends BaseController {
  constructor(private readonly module: OrderCancelReasonModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/",
      this.validateRequest("query", GetOrderReasonsQueryParamSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
