import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { EntityTagModule } from "./entity-tag.module.js"
import { GetListEntityTagSchema } from "./entity-tag.schema.js"

export class EntityTagController extends BaseController {
  constructor(private readonly module: EntityTagModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/",
      this.validateRequest("query", GetListEntityTagSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
