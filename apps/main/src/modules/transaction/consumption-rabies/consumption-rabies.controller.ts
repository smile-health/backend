import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../utils/transaction.base-controller.js"
import { ConsumptionRabiesMiddleware } from "./consumption-rabies.middleware.js"
import { ConsumptionRabiesModule } from "./consumption-rabies.module.js"

export class ConsumptionRabiesController extends BaseController {
  constructor(
    private readonly module: ConsumptionRabiesModule,
    private readonly middleware: ConsumptionRabiesMiddleware
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
        await this.module.consumption(c, body)
        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    router.get("/rabies-sequence", async (c) => {
      const response = await this.module.getRabiesSequences(c)
      return c.json(response, StatusCodes.OK)
    })

    return router
  }
}
