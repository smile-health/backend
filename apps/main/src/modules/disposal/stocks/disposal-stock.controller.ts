import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { DisposalStockMiddleware } from "./disposal-stock.middleware.js"
import { DisposalStockModule } from "./disposal-stock.module.js"

export class DisposalStockController extends BaseController {
  constructor(
    private readonly module: DisposalStockModule,
    private readonly middleware: DisposalStockMiddleware,
    private readonly roleMiddleware: RoleMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("disposal-stocks")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/stock",
      this.validateRequest("query", this.middleware.list),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/stock/xls",
      this.validateRequest("query", this.middleware.list),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.export(c, query)
        c.set("file", file)
      }
    )

    router.get(
      "/stocks/detail",
      this.validateRequest("query", this.middleware.list),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.details(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
