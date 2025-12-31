import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { OccupationModule } from "./occupation.module.js"
import { OccupationPaginatedRequestSchema } from "./occupation.schema.js"

export class OccupationController extends BaseController {
  constructor(private readonly module: OccupationModule) {
    super("occupations")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", OccupationPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
