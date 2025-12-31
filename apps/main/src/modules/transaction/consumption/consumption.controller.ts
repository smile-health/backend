import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../utils/transaction.base-controller.js"
import { ConsumptionMiddleware } from "./consumption.middleware.js"
import { ConsumptionModule } from "./consumption.module.js"

export class ConsumptionController extends BaseController {
  constructor(
    private readonly module: ConsumptionModule,
    private readonly middleware: ConsumptionMiddleware
  ) {
    super("consumption-rabies")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/consumption",
      this.middleware.logErrors,
      this.validateRequest("json", this.middleware.consumption),
      async (c) => {
        const body = c.req.valid("json")
        const result = await this.module.consumption(c, body)
        return c.json(result, StatusCodes.CREATED)
      }
    )

    return router
  }
}
