import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { UserActivityModule } from "./user-activity.module.js"
import { UserActivityMiddleware } from "./user-activity.middleware.js"

export class UserActivityController extends BaseController {
  constructor(
    private readonly module: UserActivityModule,
    private readonly middleware: UserActivityMiddleware,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("user_activity")
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
      "/all",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getActivityCount(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/entity",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getActivityByEntity(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/entity/export",
      this.validateRequest("query", this.middleware.common),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.export(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
