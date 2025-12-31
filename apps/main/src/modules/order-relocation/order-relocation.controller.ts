import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { OrderRelocationMiddleware } from "./order-relocation.middleware.js"

export class OrderRelocationController extends BaseController {
  constructor(
    private readonly roleMiddleware: RoleMiddleware,
    private readonly middleware: OrderRelocationMiddleware,
    private readonly module: OrderRelocationModule
  ) {
    super("order-relocation")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/relocation",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("json", this.middleware.createSchemaOrderRelocation),
      async (c) => {
        const body = await c.req.json()
        const response = await this.module.create(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    return router
  }
}
