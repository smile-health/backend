import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MaritalStatusModule } from "./marital-status.module.js"
import { MaritalStatusPaginatedRequestSchema } from "./marital-status.schema.js"

export class MaritalStatusController extends BaseController {
  constructor(private readonly module: MaritalStatusModule) {
    super("marital-status")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", MaritalStatusPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
