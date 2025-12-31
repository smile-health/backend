import { ExcelMiddleware } from "@smile/lib/middlewares"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { BudgetSourceMiddleware } from "./budget-source.middleware.js"
import { BudgetSourceModule } from "./budget-source.module.js"
import {
  DetailSchema,
  GetBudgetSourceQueriesSchema,
  UpdateStatusRequestSchema,
} from "./budget-source.schema.js"

export class BudgetSourceController extends BaseController {
  constructor(
    private readonly module: BudgetSourceModule,
    private readonly excelMiddleware: ExcelMiddleware,
    private readonly middleware: BudgetSourceMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/xls",
      this.validateRequest("query", GetBudgetSourceQueriesSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.exportExcel(c, query)
        c.set("file", file)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", this.middleware.list),
      async (c) => {
        const query = c.req.valid("query")
        const rsp = await this.module.list(c, query)
        return c.json(rsp, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", DetailSchema),
      async (c) => {
        const param = c.req.valid("param")
        const rsp = await this.module.detail(c, param.id)
        return c.json(rsp, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", DetailSchema),
      this.validateRequest("json", UpdateStatusRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.updateStatus(c, param.id, body)
        return c.json({ status: true }, StatusCodes.OK)
      }
    )

    return router
  }
}
