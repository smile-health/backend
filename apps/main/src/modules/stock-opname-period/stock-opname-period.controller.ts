import { ValidationError } from "@smile-health/lib/error.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares/excel.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { StockOpnamePeriodMiddleware } from "./stock-opname-period.middleware.js"
import { StockOpnamePeriodModule } from "./stock-opname-period.module.js"
import StockOpnamePeriodRepository from "./stock-opname-period.repository.js"
import {
  CreateStockOpnamePeriodRequest,
  GetStockOpnamePeriodsQueries,
  UpdateStockOpnamePeriodRequest,
  UpdateStockOpnamePeriodStatusRequest,
} from "./stock-opname-period.schema.js"

export class StockOpnamePeriodController extends BaseController {
  private readonly stockOpnamePeriodMiddleware: StockOpnamePeriodMiddleware

  constructor(
    private readonly module: StockOpnamePeriodModule,
    private readonly repo: StockOpnamePeriodRepository,
    private readonly excelMiddleware: ExcelMiddleware = new ExcelMiddleware()
  ) {
    super()
    this.stockOpnamePeriodMiddleware = new StockOpnamePeriodMiddleware(
      this.repo
    )
  }

  public getRoutes(): Hono {
    const app = new Hono()

    app.get(
      "/",
      this.validateRequest("query", GetStockOpnamePeriodsQueries),
      async (c) => {
        const params = c.req.valid("query")
        const periods = await this.module.getAll(c, params)
        return c.json(periods)
      }
    )

    app.post(
      "/",
      this.validateRequest("json", CreateStockOpnamePeriodRequest),
      this.stockOpnamePeriodMiddleware.checkPeriodExists(),
      async (c) => {
        if (c.var.errors) {
          throw new ValidationError()
        }
        const data = c.req.valid("json")
        const res = await this.module.create(c, data)
        return c.json(res, StatusCodes.CREATED)
      }
    )

    app.get(
      "/xls",
      this.validateRequest("query", GetStockOpnamePeriodsQueries),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.exportExcel(c, query)
        c.set("file", file)
      }
    )

    app.put(
      "/:id",
      this.validateRequest("json", UpdateStockOpnamePeriodRequest),
      this.stockOpnamePeriodMiddleware.checkPeriodExists(),
      async (c) => {
        if (c.var.errors) {
          throw new ValidationError()
        }

        const { id } = c.req.param()
        const data = c.req.valid("json")
        const res = await this.module.update(c, Number(id), data)
        return c.json(res)
      }
    )

    app.patch(
      "/:id/status",
      this.validateRequest("json", UpdateStockOpnamePeriodStatusRequest),
      async (c) => {
        const { id } = c.req.param()
        const statusData = c.req.valid("json")
        const res = await this.module.updateStatus(
          c,
          Number(id),
          statusData.status
        )
        return c.json(res)
      }
    )

    app.put(
      "/:id/status",
      this.validateRequest("json", UpdateStockOpnamePeriodStatusRequest),
      async (c) => {
        const { id } = c.req.param()
        const statusData = c.req.valid("json")
        const res = await this.module.updateStatus(
          c,
          Number(id),
          statusData.status
        )
        return c.json(res)
      }
    )

    app.get("/:id", async (c) => {
      const { id } = c.req.param()
      const period = await this.module.getById(c, Number(id))
      return c.json(period)
    })

    return app
  }
}
