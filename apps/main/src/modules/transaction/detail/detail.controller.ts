import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { TransactionDetailModule } from "./detail.module.js"
import { TransactionDetailRequestSchema } from "./detail.schema.js"

export class TransactionDetailController extends BaseController {
  constructor(private readonly module: TransactionDetailModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/:id",
      this.validateRequest("param", TransactionDetailRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, { id: param.id })

        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
