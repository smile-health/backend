import { Hono } from "hono"
import { BaseController } from "../base.controller"
import { ColdstorageModule } from "./coldstorage.module"
import { StatusCodes } from "http-status-codes"
import { ColdStorageMiddleware } from "./coldstorage.middleware"
import {
  GetColdstorageListQuerySchema,
  GetColdStorageParamSchema,
  GetDetailColdstorageParamSchema,
} from "./coldstorage.shcema"
import { ExcelMiddleware } from "@smile-health/lib/middlewares"

export class ColdstorageController extends BaseController {
  constructor(
    private readonly module: ColdstorageModule,
    private readonly middleware: ColdStorageMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super()
  }

  public getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.create(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", GetColdstorageListQuerySchema),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.list(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", GetColdstorageListQuerySchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const paramQuery = c.req.valid("query")
        const file = await this.module.exportList(c, paramQuery)
        c.set("file", file)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", GetColdStorageParamSchema),
      this.validateRequest("query", GetDetailColdstorageParamSchema),
      async (c) => {
        const param = c.req.valid("param")
        const filter = c.req.valid("query")

        const response = await this.module.detail(c, param.id, filter)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id/export",
      this.validateRequest("param", GetColdStorageParamSchema),
      this.validateRequest("query", GetDetailColdstorageParamSchema),
      async (c) => {
        const param = c.req.valid("param")
        const filter = c.req.valid("query")

        const file = await this.module.export(c, param.id, filter)

        if (!file.buffer) {
          return c.json(
            { error: "File buffer is missing" },
            StatusCodes.INTERNAL_SERVER_ERROR
          )
        }
        return c.body(file.buffer, 200, {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${file.filename}.xlsx"`,
        })
      }
    )

    return router
  }
}
