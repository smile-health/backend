import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EventReportStatusModule } from "./event-report-status.module.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"

export class EventReportStatusController extends BaseController {
  constructor(
    private readonly module: EventReportStatusModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("event-report-status")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/status",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const res = await this.module.list(c)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
