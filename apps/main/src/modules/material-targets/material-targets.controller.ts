import { Hono } from "hono"
import { BaseController } from "../base.controller.js"
import { MaterialTargetsModule } from "./material-targets.module.js"
import { MaterialTargetsPaginatedRequestSchema } from "./material-targets.schema.js"
import { StatusCodes } from "http-status-codes"

export class MaterialTargetsController extends BaseController {
  constructor(private readonly module: MaterialTargetsModule) {
    super()
  }

  public getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", MaterialTargetsPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")

        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
