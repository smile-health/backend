import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MaterialMiddleware } from "./material.middleware.js"
import { MaterialModule } from "./material.module.js"
import {
  GetMaterialsQueriesSchema,
  UpdateStatusRequestSchema,
} from "./material.schema.js"

export class MaterialController extends BaseController {
  constructor(
    private module: MaterialModule,
    private middleware: MaterialMiddleware,
    private roleMiddleware: RoleMiddleware,
    private excelMiddleware: ExcelMiddleware
  ) {
    super("materials")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.use(
      this.roleMiddleware.allow([USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN])
    )

    router.get(
      "/",
      this.validateRequest("query", GetMaterialsQueriesSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", GetMaterialsQueriesSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.export(c, query)
        c.set("file", file)
      }
    )

    router.get(
      "/xls-template",
      this.validateRequest("query", GetMaterialsQueriesSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.template(c, query)
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
      "/xls",
      this.validateRequest("query", GetMaterialsQueriesSchema),
      this.excelMiddleware.validateFileMiddleware,
      this.validateExcelRequest(
        this.middleware.importMaterialSchema,
        this.middleware.importMaterialTemplate
      ),
      async (c) => {
        const query = c.req.valid("query")
        const rows = c.req.valid("json")
        const result = await this.module.import(c, query, rows)
        return c.json(
          { status: true, message: `Successfully imported ${result} rows` },
          StatusCodes.OK
        )
      }
    )

    router.put(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", this.middleware.updateMaterialSchema),
      async (c) => {
        const param = c.req.valid("param")
        const request = c.req.valid("json")
        const response = await this.module.update(c, param.id, request)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", UpdateStatusRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const request = c.req.valid("json")
        await this.module.updateStatus(c, param.id, request)
        return c.json({ status: true }, StatusCodes.OK)
      }
    )

    return router
  }
}
