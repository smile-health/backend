import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { ReligionModule } from "./religion.module.js"
import { ReligionPaginatedRequestSchema } from "./religion.schema.js"

export class ReligionController extends BaseController {
  constructor(private readonly module: ReligionModule) {
    super("religions")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", ReligionPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
