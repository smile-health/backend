import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { PeriodicMaterialStockModule } from "./periodic-material-stock.module.js"
import { PeriodicMaterialStockQueryParamsSchema } from "./periodic-material-stock.schema.js"

export class PeriodicMaterialStockController extends BaseController {
  constructor(
    private readonly module: PeriodicMaterialStockModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("periodic_material_stock")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.use(
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.SATUSEHAT, DEVICE_TYPE.web],
      ])
    )

    router.get(
      "/",
      this.validateRequest("query", PeriodicMaterialStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getReport(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/export",
      this.validateRequest("query", PeriodicMaterialStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getReportExport(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    router.get(
      "/export-all",
      this.validateRequest("query", PeriodicMaterialStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.exportAllReport(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
