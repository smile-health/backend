import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { ReconciliationAdditionalModule } from "./reconciliation-additional.module.js"
import { GetListAdditionalSchema } from "./reconciliation-additional.schema.js"

export class ReconciliationAdditionalController extends BaseController {
  constructor(private readonly module: ReconciliationAdditionalModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/actions",
      this.validateRequest("query", GetListAdditionalSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query, "action")
        return c.json(res, StatusCodes.OK)
      }
    )

    router.get(
      "/reasons",
      this.validateRequest("query", GetListAdditionalSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query, "reason")
        return c.json(res, StatusCodes.OK)
      }
    )

    router.get(
      "/categories",
      this.validateRequest("query", GetListAdditionalSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query, "category")
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
