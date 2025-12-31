import { BaseController } from "@smile/lib/base/controller"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MaterialVolumesModule } from "./material-volumes.module"
import { MaterialVolumesMiddleware } from "./material-volumes.middleware"
import { GetMaterialVolumesQueryParamSchema } from "./material-volumes.schema"
import { IdParamsSchema } from "@smile/lib/types/param"
import { ExcelMiddleware } from "@smile/lib/middlewares"

export class MaterialVolumesController extends BaseController {
  constructor(
    private readonly module: MaterialVolumesModule,
    private readonly middleware: MaterialVolumesMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("material-volumes")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetMaterialVolumesQueryParamSchema),
      async (c) => {
        const queryParam = c.req.valid("query")
        const response = await this.module.list(c, queryParam)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", GetMaterialVolumesQueryParamSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const queryParam = c.req.valid("query")
        const file = await this.module.export(c, queryParam)
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

    router.get(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, param.id)
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
        console.log(rows)
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

    return router
  }
}
