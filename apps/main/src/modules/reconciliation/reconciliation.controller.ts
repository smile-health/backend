import { BaseController } from "@smile/lib/base/controller.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { ReconciliationMiddleware } from "./reconciliation.middleware.js"
import { ReconciliationModule } from "./reconciliation.module.js"
import { GetListReconciliationSchema } from "./reconciliation.schema.js"

export class ReconciliationController extends BaseController {
  constructor(
    private readonly module: ReconciliationModule,
    private readonly middleware: ReconciliationMiddleware
  ) {
    super("reconciliation")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetListReconciliationSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    router.post(
      "/",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const request = c.req.valid("json")
        await this.module.create(c, request)
        return c.body(null, StatusCodes.CREATED)
      }
    )

    router.get(
      "/generate",
      this.validateRequest("query", this.middleware.generate),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.getGenerate(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", GetListReconciliationSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.export(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const param = c.req.valid("param")
        const res = await this.module.detail(c, param.id)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
