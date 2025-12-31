import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { ReactionModule } from "./reaction.module.js"
import { ReactionPaginatedRequestSchema } from "./reaction.schema.js"

export class ReactionController extends BaseController {
  constructor(private readonly module: ReactionModule) {
    super("reactions")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", ReactionPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
