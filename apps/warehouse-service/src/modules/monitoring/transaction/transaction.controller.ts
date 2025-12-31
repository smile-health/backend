import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { MonitoringTransactionMiddleware } from "./transaction.middleware.js"
import { MonitoringTransactionModule } from "./transaction.module.js"

export class MonitoringTransactionController extends BaseController {
  constructor(
    private readonly module: MonitoringTransactionModule,
    private readonly middleware: MonitoringTransactionMiddleware,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("monitoring_transaction")
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

        const featureEnabled = c.get("feature-enabled")

        const isEnabled = featureEnabled(
          "dashboard.transaction_monitoring.new",
          true
        )

        if (isEnabled) {
          const response = await this.module.getChart(c, queryParams)
          return c.json(response, StatusCodes.OK)
        } else {
          const response = await this.module.getChartOld(c, queryParams)
          return c.json(response, StatusCodes.OK)
        }
      }
    )

    router.get(
      "/big-number",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getBigNumber(c, queryParams)
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
      "/entity-complete",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getEntityComplete(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/material",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getMaterial(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/reason",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getTransactionReason(c, queryParams)
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
