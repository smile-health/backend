import { Hono } from "hono"
import { ProgramModule } from "./program.module.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { StatusCodes } from "http-status-codes"
import { ProgramMiddleware } from "./program.middleware.js"
import { DetailSchema } from "./program.schema.js"
import { ExcelMiddleware } from "@smile/lib/middlewares/excel.middleware.js"

export class ProgramController extends BaseController {
  constructor(
    private readonly module: ProgramModule,
    private readonly middleware: ProgramMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("workspaces")
  }

  getRoutes(): Hono {
    const router = new Hono()

    // create program
    router.post(
      "/",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        const data = await this.module.create(c, body)
        return c.json(data, StatusCodes.OK)
      }
    )

    // list program
    router.get(
      "/",
      this.validateRequest("query", this.middleware.list),
      async (c) => {
        const params = c.req.valid("query")
        const data = await this.module.list(c, params)
        return c.json(data, StatusCodes.OK)
      }
    )

    // export program
    router.get(
      "/xls",
      this.validateRequest("query", this.middleware.list),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.export(c, query)
        c.set("file", file)
      }
    )

    // detail program
    router.get(
      "/:id",
      this.validateRequest("param", DetailSchema),
      async (c) => {
        const param = c.req.valid("param")
        const data = await this.module.detail(c, param.id)
        return c.json(data, StatusCodes.OK)
      }
    )

    // update program
    router.put(
      "/:id",
      this.validateRequest("param", DetailSchema),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const body = c.req.valid("json")
        const param = c.req.valid("param")
        const data = await this.module.update(c, body, param.id)
        return c.json(data, StatusCodes.OK)
      }
    )

    return router
  }
}
