import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { OrderStatusValidateMiddleware } from "./order-status-validate.middleware.js"
import { OrderStatusValidateModule } from "./order-status-validate.module.js"
import { GetDetailOrderValidateSchema } from "./order-status-validate.schema.js"

export class OrderStatusValidateController extends BaseController {
  constructor(
    private readonly middleware: OrderStatusValidateMiddleware,
    private readonly module: OrderStatusValidateModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("order_status")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.put(
      "/:id/validate",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("param", GetDetailOrderValidateSchema),
      this.middleware.detailOrder,
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.update(c, param.id, body)
        return c.json(response ?? {}, StatusCodes.OK)
      }
    )

    return router
  }
}
