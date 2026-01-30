import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MaterialSubtypeModule } from "./material-subtype.module.js"
import { GetListSubtypeSchema } from "./material-subtype.schema.js"

export class MaterialSubtypeController extends BaseController {
  constructor(private readonly module: MaterialSubtypeModule) {
    super("material_subtype")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/program-plans/subtype",
      this.validateRequest("query", GetListSubtypeSchema),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.list(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
