import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { EntityTypeModule } from "./entity-type.module.js"
import { GetListEntityTypeSchema } from "./entity-type.schema.js"

export class EntityTypeController extends BaseController {
  constructor(private module: EntityTypeModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/",
      this.validateRequest("query", GetListEntityTypeSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
