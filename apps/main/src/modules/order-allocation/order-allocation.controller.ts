import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { OrderAllocationMiddleware } from "./order-allocation.middleware.js"
import { OrderAllocationModule } from "./order-allocation.module.js"

export class OrderAllocationController extends BaseController {
  constructor(
    private readonly module: OrderAllocationModule,
    private readonly middleware: OrderAllocationMiddleware,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/distribution",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("json", this.middleware.createSchemaOrderAllocation),
      async (c) => {
        const body = await c.req.json()
        const response = await this.module.create(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    return router
  }
}
