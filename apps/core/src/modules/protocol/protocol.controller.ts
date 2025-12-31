import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { ProtocolModule } from "./protocol.module.js"
import { GetListProtocolSchema } from "./protocol.schema.js"

export class ProtocolController extends BaseController {
  constructor(private readonly module: ProtocolModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/",
      this.validateRequest("query", GetListProtocolSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
