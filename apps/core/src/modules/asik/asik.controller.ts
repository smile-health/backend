import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AsikModule } from "./asik.module.js"
import { AsikAggregateSyncRequestSchema } from "./asik.schema.js"

export class AsikController extends BaseController {
  constructor(private readonly module: AsikModule) {
    super("asik")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/aggregate-sync",
      this.validateRequest("json", AsikAggregateSyncRequestSchema),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.syncAggregate(c.var.trx, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
