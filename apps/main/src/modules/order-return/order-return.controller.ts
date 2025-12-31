import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { OrderReturnMiddleware } from "./order-return.middleware.js"
import { OrderReturnModule } from "./order-return.module.js"

export class OrderReturnController extends BaseController {
  constructor(
    private readonly middleware: OrderReturnMiddleware,
    private readonly module: OrderReturnModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("order")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/return",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.create(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    return router
  }
}
