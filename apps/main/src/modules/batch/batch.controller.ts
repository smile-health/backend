import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { BatchModule } from "./batch.module.js"
import { getListBatchSchema } from "./batch.schema.js"

export class BatchController extends BaseController {
  constructor(private readonly module: BatchModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/",
      this.validateRequest("query", getListBatchSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        if (res.total_item === 0) return c.body(null, StatusCodes.NO_CONTENT)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
