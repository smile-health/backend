import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { OrderCentralDeliveryMiddleware } from "./order-central-delivery.middleware.js"
import { OrderCentralDeliveryModule } from "./order-central-delivery.module.js"
import { StatusCodes } from "http-status-codes"

export class OrderCentralDeliveryController extends BaseController {
  constructor(
    private readonly orderCentralDeliveryModule: OrderCentralDeliveryModule,
    private readonly orderCentralDeliveryMiddleware: OrderCentralDeliveryMiddleware,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("order_central_delivery")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/central-distribution",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANUFACTURE, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
      ]),
      this.validateRequest(
        "json",
        this.orderCentralDeliveryMiddleware.createMiddleware
      ),
      async (c) => {
        const body = c.req.valid("json")
        const create = await this.orderCentralDeliveryModule.create(c, body)
        return c.json({ id: create }, StatusCodes.CREATED)
      }
    )

    return router
  }
}
