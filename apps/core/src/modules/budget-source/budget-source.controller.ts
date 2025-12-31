import { RoleValidationMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares/excel.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BudgetSourceMiddleware } from "./budget-source.middleware.js"
import { BudgetSourceModule } from "./budget-source.module.js"
import {
  DetailSchema,
  GetBudgetSourceQueriesSchema,
} from "./budget-source.schema.js"

export class BudgetSourceController extends BaseController {
  constructor(
    private readonly module: BudgetSourceModule,
    private readonly middleware: BudgetSourceMiddleware,
    private readonly roleValidationMiddleware: RoleValidationMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("budget_source")
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

    router.post(
      "/",
      this.validateRequest("json", this.middleware.created),
      async (c) => {
        const body = c.req.valid("json")
        body.created_by = c.var.accountID
        body.updated_by = c.var.accountID
        const rsp = await this.module.create(c, body)
        return c.json(rsp, StatusCodes.CREATED)
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

    router.put(
      "/:id",
      this.validateRequest("param", DetailSchema),
      this.validateRequest("json", this.middleware.updated),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        body.updated_by = c.var.accountID
        const rsp = await this.module.update(c, body, param)
        return c.json(rsp, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", DetailSchema),
      async (c) => {
        const param = c.req.valid("param")
        const rsp = await this.module.detail(c, param)
        return c.json(rsp, StatusCodes.OK)
      }
    )

    return router
  }
}
