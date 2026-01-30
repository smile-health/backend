import { ExcelMiddleware } from "@smile-health/lib/middlewares"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { UserModule } from "./user.module.js"
import { DetailSchema, GetUserQueriesSchema, UpdateStatusRequestSchema } from "./user.schema.js"

export class UserController extends BaseController {
  constructor(
    private readonly module: UserModule,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/xls",
      this.validateRequest("query", GetUserQueriesSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.exportExcel(c, query)
        c.set("file", file)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", GetUserQueriesSchema),
      async (c) => {
        const query = c.req.valid("query")
        const result = await this.module.list(c, query)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", DetailSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const result = await this.module.detail(c, id)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", UpdateStatusRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const request = c.req.valid("json")
        await this.module.updateStatus(c, param.id, request)
        return c.json({ status: true }, StatusCodes.OK)
      }
    )

    router.get(
      "/:id/chg_history",
      this.validateRequest("param", DetailSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const result = await this.module.getChangeLogs(c, id)
        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
