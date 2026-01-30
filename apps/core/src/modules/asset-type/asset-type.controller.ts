import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AssetTypeModule } from "./asset-type.module.js"
import { AssetTypeMiddleware } from "./asset-type.middleware.js"
import {
  UpdateAssetTypeParamSchema,
  GetAssetTypeParamSchema,
  DownloadTemplateSchema,
  ImportTemplateSchema,
} from "./asset-type.schema.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares"

export class AssetTypeController extends BaseController {
  constructor(
    private readonly module: AssetTypeModule,
    private readonly middleware: AssetTypeMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("asset_type")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/xls",
      this.validateRequest("query", this.middleware.export),
      this.excelMiddleware.handleExport,
      async (c) => {
        const paramQuery = c.req.valid("query")
        const file = await this.module.export(c, paramQuery)
        c.set("file", file)
      }
    )

    router.get(
      "/xls-template",
      this.validateRequest("query", DownloadTemplateSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const param = c.req.valid("query")
        const file = await this.module.template(c, param)
        c.set("file", file)
      }
    )

    router.post(
      "/xls",
      this.validateRequest("query", ImportTemplateSchema),
      this.excelMiddleware.validateFileMiddleware,
      this.middleware.import,
      async (c) => {
        const params = c.req.valid("query")
        const rows = c.req.valid("json")
        const response = await this.module.import(c, rows, params)
        return c.json(response, StatusCodes.CREATED)
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
      this.validateRequest("param", UpdateAssetTypeParamSchema),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.update(c, Number(param.id), body)
        c.status(StatusCodes.NO_CONTENT)
        return c.json(undefined)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", GetAssetTypeParamSchema),
      this.middleware.detail,
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, Number(param.id))
        return c.json(response, StatusCodes.OK)
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

    return router
  }
}
