import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { Hono } from "hono"
import { ReconciliationModule } from "./reconciliation.module.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { ReconciliationQueryParamsSchema } from "./reconciliation.schema.js"
import { StatusCodes } from "http-status-codes"

export class ReconciliationController extends BaseController {
  constructor(
    private readonly reconciliationModule: ReconciliationModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("reconciliation")
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
      "/summary-report",
      this.validateRequest("query", ReconciliationQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.reconciliationModule.barChartReport(
          c,
          queryParams
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/entities-report",
      this.validateRequest("query", ReconciliationQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.reconciliationModule.entityTableReport(
          c,
          queryParams
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/entities-report/export",
      this.validateRequest("query", ReconciliationQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.reconciliationModule.entityTableReportExport(
          c,
          queryParams
        )
        return this.downloadExcel(c, file)
      }
    )

    return router
  }
}
