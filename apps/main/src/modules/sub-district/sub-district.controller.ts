import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { SubDistrictModule } from "./sub-district.module.js"
import { GetListSubDistrictSchema } from "./sub-district.schema.js"

export class SubDistrictController extends BaseController {
  constructor(private readonly module: SubDistrictModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/",
      this.validateRequest("query", GetListSubDistrictSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
