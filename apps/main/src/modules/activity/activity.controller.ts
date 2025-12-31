import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { ActivityMiddleware } from "./activity.middleware.js"
import { ActivityModule } from "./activity.module.js"
import {
  GetActivityQuerySchema,
  GetActivityParamSchema,
  UpdateActivityParamSchema,
} from "./activity.schema.js"

export class ActivityController extends BaseController {
  constructor(
    private readonly module: ActivityModule,
    private readonly middleware: ActivityMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("activity")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/xls",
      this.validateRequest("query", GetActivityQuerySchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.export(c, query)
        c.set("file", file)
      }
    )

    router.get(
      "/xls-template",
      this.excelMiddleware.handleExport,
      async (c) => {
        const file = await this.module.template(c)
        c.set("file", file)
      }
    )

    router.post(
      "/xls",
      this.excelMiddleware.validateFileMiddleware,
      this.middleware.import,
      async (c) => {
        const rows = c.req.valid("json")
        const response = await this.module.import(c, rows)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", this.middleware.list),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", GetActivityParamSchema),
      this.middleware.detail,
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, param.id)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.create(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", GetActivityParamSchema),
      this.validateRequest("json", this.middleware.status),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.status(c, param.id, body.status)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id",
      this.validateRequest("param", UpdateActivityParamSchema),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.update(c, param.id, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
