import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { WhoPqsModule } from "./who-pqs.module.js"
import { GetWhoPqsQueryParamSchema } from "./who-pqs.schema.js"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares"
import { WhoPqsMiddleware } from "./who-pqs.middleware.js"

export class WhoPqsController extends BaseController {
  constructor(
    private readonly module: WhoPqsModule,
    private readonly excelMiddleware: ExcelMiddleware,
    private readonly middleware: WhoPqsMiddleware
  ) {
    super("who-pqs")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/",
      this.validateRequest("json", this.middleware.createSchema),
      async (c) => {
        const body = await c.req.json()
        const response = await this.module.create(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.put(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", this.middleware.updateSchema),
      async (c) => {
        const param = c.req.valid("param")
        const body = await c.req.json()
        await this.module.update(c, param.id, body)
        c.status(StatusCodes.NO_CONTENT)
        return c.json(undefined)
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", GetWhoPqsQueryParamSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const queryParam = c.req.valid("query")
        const file = await this.module.export(c, queryParam)
        c.set("file", file)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", GetWhoPqsQueryParamSchema),
      async (c) => {
        const queryParam = c.req.valid("query")
        const response = await this.module.list(c, queryParam)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, param.id)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
