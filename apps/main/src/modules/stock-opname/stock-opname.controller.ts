import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { StockOpnameMiddleware } from "./stock-opname.middleware.js"
import { StockOpnameModule } from "./stock-opname.module.js"
import StockOpnameRepository from "./stock-opname.repository.js"
import { GetStockOpnamesQueries } from "./stock-opname.schema.js"
import { ValidationError } from "@smile/lib/error.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"

export class StockOpnameController extends BaseController {
  constructor(
    private readonly module: StockOpnameModule,
    private readonly repo: StockOpnameRepository,
    private readonly middleware: StockOpnameMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super()
  }

  public getRoutes(): Hono {
    const app = new Hono()

    app.get(
      "/",
      this.validateRequest("query", GetStockOpnamesQueries),
      async (c) => {
        const params = c.req.valid("query")
        const opnames = await this.module.getAll(c, params)
        return c.json(opnames)
      }
    )

    app.post(
      "/",
      this.middleware.validateSchema(),
      this.middleware.checkIsUniqueMaterialAndBatch(),
      this.middleware.checkIsWithinPeriod(),
      async (c) => {
        if (c.var.errors) {
          throw new ValidationError()
        }
        const data = c.req.valid("json")
        await this.module.create(c, data)
        return c.json({}, StatusCodes.CREATED)
      }
    )

    app.get(
      "/xls",
      this.validateRequest("query", GetStockOpnamesQueries),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.export(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return app
  }
}
