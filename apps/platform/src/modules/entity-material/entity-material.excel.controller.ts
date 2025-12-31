import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EntityMaterialTemplate } from "./entity-material.excel.js"
import { EntityMaterialExcelMiddleware } from "./entity-material.excel.middleware.js"
import { EntityMaterialExcelModule } from "./entity-material.excel.module.js"
import { GetImportEntityMaterialQueriesSchema } from "./entity-material.schema.js"

export class EntityMaterialExcelController extends BaseController {
  constructor(
    private module: EntityMaterialExcelModule,
    private middleware: EntityMaterialExcelMiddleware,
    private roleMiddleware: RoleMiddleware,
    private excelMiddleware: ExcelMiddleware
  ) {
    super("entity_material")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/xls",
      this.roleMiddleware.allow([USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN]),
      this.excelMiddleware.validateFileMiddleware,
      this.middleware.logErrors,
      this.validateExcelRequest(
        this.middleware.import,
        new EntityMaterialTemplate(),
        this.middleware.validateImport
      ),
      async (c) => {
        const rows = c.req.valid("json")
        const result = await this.module.import(c, rows)
        await this.module.logImport(c)
        return c.json(
          {
            status: true,
            message: `Successfully imported ${result} rows`,
          },
          StatusCodes.OK
        )
      }
    )

    router.get(
      "/template",
      this.roleMiddleware.allow([USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN]),
      this.validateRequest("query", this.middleware.template),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.template(c, query)
        c.set("file", file)
      }
    )

    router.get(
      "",
      this.roleMiddleware.allow([USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN]),
      this.validateRequest("query", GetImportEntityMaterialQueriesSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        if (res.data.length === 0) {
          return c.body(null, StatusCodes.NO_CONTENT)
        }
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
