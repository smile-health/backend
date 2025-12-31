import { Hono } from "hono"
import { BaseController } from "../base.controller"
import { GetCceigatQueryParamsSchema } from "./ccigat.schema"
import { StatusCodes } from "http-status-codes"
import { CceigatModule } from "./cceigat.module"

export class CceigatController extends BaseController {
  constructor(private readonly module: CceigatModule) {
    super()
  }

  public getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetCceigatQueryParamsSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
