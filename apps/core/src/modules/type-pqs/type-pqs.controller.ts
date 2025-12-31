import { Hono } from "hono"
import { BaseController } from "../base.controller"
import { TypePQsModule } from "./type-pqs.module"
import { GetTypePQsQueryParamsSchema } from "./type-pqs.schema"
import { StatusCodes } from "http-status-codes"

export class TypePQsController extends BaseController {
  constructor(private readonly module: TypePQsModule) {
    super()
  }

  public getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetTypePQsQueryParamsSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
