import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AnnualCommitmentMiddleware } from "./annual-commitment.middleware.js"
import { AnnualCommitmentModule } from "./annual-commitment.module.js"

export class AnnualCommitmentController extends BaseController {
  constructor(
    private readonly module: AnnualCommitmentModule,
    private readonly middleware: AnnualCommitmentMiddleware,
    private readonly roleMiddleware: RoleMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("annual_commitment")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/xls",
      this.validateRequest("query", this.middleware.list),
      this.excelMiddleware.handleExport,
      async (c) => {
        const paramQuery = c.req.valid("query")
        const file = await this.module.export(c, paramQuery)
        c.set("file", file)
      }
    )

    router.get(
      "/xls-template",
      this.middleware.template,
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
        const paramQuery = c.req.valid("query")
        const response = await this.module.list(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      this.middleware.detail,
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, Number(param.id))
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
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      this.middleware.detail,
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.update(c, Number(param.id), body)
        return c.json(undefined, StatusCodes.NO_CONTENT)
      }
    )

    return router
  }
}
