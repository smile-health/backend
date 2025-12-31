import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AppMobileNotifModule } from "./app-mobile-notif.module.js"

export class AppMobileNotifController extends BaseController {
  constructor(
    private readonly appMobileNotifModule: AppMobileNotifModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("app-mobile-notif")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/material",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp = await this.appMobileNotifModule.getNotifMaterial(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    router.get(
      "/order",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp = await this.appMobileNotifModule.getNotifOrder(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    return router
  }
}
