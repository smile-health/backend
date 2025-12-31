import { ExcelMiddleware } from "@/common/middlewares/excel.middleware.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MonitoringStockMiddleware } from "./stock.middleware.js"
import { MonitoringStockModule } from "./stock.module.js"

export class MonitoringStockController extends BaseController {
  constructor(
    private readonly module: MonitoringStockModule,
    private readonly middleware: MonitoringStockMiddleware,
    private readonly roleMiddleware: RoleMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("monitoring_stock")
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
      "/chart",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getChart(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/province",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getProvince(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/regency",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getRegency(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/entity",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getEntity(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/entity-stock",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getEntityStock(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/sismal",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getEntityStock(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/material-entity",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getMaterialEntity(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/export",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getExportCsv(c, queryParams)
        c.res.headers.set(
          "Content-Disposition",
          `attachment; filename="${file.filename}.csv"`
        )
        c.res.headers.set("Access-Control-Expose-Headers", "Filename")
        c.res.headers.set("Filename", `${file.filename}.csv`)
        c.res.headers.set(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

        return new Response(file.buffer, {
          headers: c.res.headers,
        })
      }
    )

    return router
  }
}
