import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { OrderStatusFulfilledMiddleware } from "./order-status-fulfilled.middleware.js"
import { OrderStatusFulfilledModule } from "./order-status-fulfilled.module.js"
import { GetDetailOrderSchema } from "./order-status-fulfilled.schema.js"

export class OrderStatusFulfilledController extends BaseController {
  constructor(
    private readonly middleware: OrderStatusFulfilledMiddleware,
    private readonly module: OrderStatusFulfilledModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("order_status")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.put(
      "/:id/fulfilled",
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
