import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { OrderStatusShipMiddleware } from "./order-status-ship.middleware.js"
import { OrderStatusShipModule } from "./order-status-ship.module.js"
import { GetDetailOrderSchema } from "./order-status-ship.schema.js"

export class OrderStatusShipController extends BaseController {
  constructor(
    private readonly middleware: OrderStatusShipMiddleware,
    private readonly module: OrderStatusShipModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("order_status")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.put(
      "/:id/ship",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("param", GetDetailOrderSchema),
      this.middleware.detailOrder,
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.update(c, param.id, body)
        return c.json(undefined, StatusCodes.NO_CONTENT)
      }
    )

    return router
  }
}
