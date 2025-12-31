import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../utils/transaction.base-controller.js"
import { ConsumptionReactionMiddleware } from "./consumption-reaction.middleware.js"
import { ConsumptionReactionModule } from "./consumption-reaction.module.js"
import { ConsumptionReactionParamSchema } from "./consumption-reaction.schema.js"

export class ConsumptionReactionController extends BaseController {
  constructor(
    private readonly module: ConsumptionReactionModule,
    private readonly middleware: ConsumptionReactionMiddleware
  ) {
    super("consumption-reaction")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/:id/kipi",
      this.validateRequest("param", ConsumptionReactionParamSchema),
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.create(c, param, body)
        return c.body(null, StatusCodes.CREATED)
      }
    )

    return router
  }
}
