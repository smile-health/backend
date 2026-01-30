import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { OrderStatusPendingMiddleware } from "./order-status-pending.middleware.js"
import { OrderStatusPendingModule } from "./order-status-pending.module.js"
import { GetDetailOrderSchema } from "./order-status-pending.schema.js"

export class OrderStatusPendingController extends BaseController {
  constructor(
    private readonly middleware: OrderStatusPendingMiddleware,
    private readonly module: OrderStatusPendingModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("order_status")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.put(
      "/:id/pending",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("param", GetDetailOrderSchema),
      this.middleware.detailOrder,
      async (c) => {
        const param = c.req.valid("param")
        await this.module.update(c, param.id)
        return c.json(undefined, StatusCodes.NO_CONTENT)
      }
    )

    return router
  }
}
