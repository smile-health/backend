import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../../base.controller.js"
import { DisposalMethodsModule } from "./disposal-methods.module.js"
import { GetDisposalMethodsQueryParamSchema } from "./disposal-methods.schema.js"

export class DisposalMethodsController extends BaseController {
  constructor(private readonly module: DisposalMethodsModule) {
    super("disposal-methods")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetDisposalMethodsQueryParamSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
