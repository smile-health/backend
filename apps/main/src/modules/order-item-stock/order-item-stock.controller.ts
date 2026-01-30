import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { OrderItemStockMiddleware } from "./order-item-stock.middleware.js"
import { OrderItemStockModule } from "./order-item-stock.module.js"
import { GetDetailOrderSchema } from "./order-item-stock.schema.js"

export class OrderItemStockController extends BaseController {
  constructor(
    private readonly middleware: OrderItemStockMiddleware,
    private readonly module: OrderItemStockModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("order_item_stock")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/:id/order-item-stocks",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("param", GetDetailOrderSchema),
      this.middleware.detailOrder,
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.create(c, param.id, body)
        return c.json(undefined, StatusCodes.NO_CONTENT)
      }
    )

    router.put(
      "/:id/order-item-stocks",
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
        const body = c.req.valid("json")
        await this.module.update(c, body)
        return c.json(undefined, StatusCodes.NO_CONTENT)
      }
    )

    return router
  }
}
