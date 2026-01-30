import { RoleValidationMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MaterialMiddleware } from "./material.middleware.js"
import { MaterialModule } from "./material.module.js"
import {
  GetMaterialsQueryParamSchema,
  GetTemplateQueryParamsSchema,
  UpdateStatusMaterialRequestSchema,
} from "./material.schema.js"

export class MaterialController extends BaseController {
  constructor(
    private readonly module: MaterialModule,
    private readonly middleware: MaterialMiddleware,
    private readonly excelMiddleware: ExcelMiddleware,
    private readonly roleValidationMiddleware: RoleValidationMiddleware
  ) {
    super("material")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetMaterialsQueryParamSchema),
      async (c) => {
        const queryParam = c.req.valid("query")
        const response = await this.module.list(c, queryParam)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", GetMaterialsQueryParamSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const queryParam = c.req.valid("query")
        const file = await this.module.export(c, queryParam)
        c.set("file", file)
      }
    )

    router.get(
      "/xls-template",
      this.validateRequest("query", GetTemplateQueryParamsSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const queryParam = c.req.valid("query")
        const template = await this.module.template(c, queryParam)
        c.set("file", template)
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

    router.get(
      "/:id/relation",
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detailRelation(c, param.id)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/",
      this.validateRequest("json", this.middleware.createSchema),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.create(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.post(
      "/xls",
      this.excelMiddleware.validateFileMiddleware,
      this.validateExcelRequest(
        this.middleware.importSchema,
        this.middleware.importTemplate
      ),
      async (c) => {
        const rows = c.req.valid("json")
        const result = await this.module.import(c, rows)
        return c.json(
          { status: true, message: `Successfully imported ${result} rows` },
          StatusCodes.OK
        )
      }
    )

    router.put(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", this.middleware.updateSchema),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.update(c, param.id, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", UpdateStatusMaterialRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.updateStatus(c, param.id, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
