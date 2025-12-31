import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EthnicModule } from "./ethnic.module.js"
import { EthnicPaginatedRequestSchema } from "./ethnic.schema.js"

export class EthnicController extends BaseController {
  constructor(private readonly module: EthnicModule) {
    super("ethnics")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", EthnicPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
