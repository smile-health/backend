import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { EntityVendorModule } from "./entity-vendor.module.js"
import { GetListEntityVendorSchema } from "./entity-vendor.schema.js"

export class EntityVendorController extends BaseController {
  constructor(
    private readonly module: EntityVendorModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/:id/vendors",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("query", GetListEntityVendorSchema),
      async (c) => {
        const param = c.req.valid("param")
        const query = c.req.valid("query")
        const response = await this.module.list(c, query, param.id)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
