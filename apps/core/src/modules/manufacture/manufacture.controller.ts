import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares/excel.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { ManufactureMiddleware } from "./manufacture.middleware.js"
import { ManufactureModule } from "./manufacture.module.js"
import {
  ManufactureDetailRequestSchema,
  ManufacturePaginatedRequestSchema,
} from "./manufacture.schema.js"

export class ManufactureController extends BaseController {
  constructor(
    private readonly module: ManufactureModule,
    private readonly middleware: ManufactureMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("manufacture")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get("/type", async (c) => {
      const response = await this.module.getManufactureTypes(c)

      return c.json(response, StatusCodes.OK)
    })

    router.get(
      "/xls",
      this.validateRequest("query", ManufacturePaginatedRequestSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.exportExcel(c, query)

        c.set("file", file)
      }
    )

    router.get(
      "/xls-template",
      this.excelMiddleware.handleExport,
      async (c) => {
        const file = await this.module.templateExcel(c)

        c.set("file", file)
      }
    )

    router.post(
      "/xls",
      this.excelMiddleware.validateFileMiddleware,
      this.middleware.excel,
      async (c) => {
        const rows = c.req.valid("json")
        const response = await this.module.importExcel(c, rows)

        return c.json(
          {
            status: true,
            message: `Successfully created ${response} rows`,
          },
          StatusCodes.OK
        )
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

    router.get(
      "/",
      this.validateRequest("query", ManufacturePaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", ManufactureDetailRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, { id: param.id })

        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id",
      this.validateRequest("param", ManufactureDetailRequestSchema),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.update(c, body, { id: param.id })

        return c.json(response, StatusCodes.OK)
      }
    )

    router.delete(
      "/:id",
      this.validateRequest("param", ManufactureDetailRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        await this.module.delete(c, { id: param.id })

        return c.json({ success: true }, StatusCodes.OK)
      }
    )

    return router
  }
}
