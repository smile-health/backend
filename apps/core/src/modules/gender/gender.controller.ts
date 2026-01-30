import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { GenderModule } from "./gender.module.js"
import { GenderPaginatedRequestSchema } from "./gender.schema.js"

export class GenderController extends BaseController {
  constructor(private readonly module: GenderModule) {
    super("genders")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GenderPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
