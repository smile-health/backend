import { BaseController } from "@smile/lib/base/controller.js"
import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { TransferStockModule } from "./transfer-stock.module.js"
import {
  ListActivitySchema,
  ListProgramSchema,
  ListStockSchema,
} from "./transfer-stock.schema.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"

export class TransferStockController extends BaseController {
  constructor(
    private readonly module: TransferStockModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.use(
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ])
    )

    router.get(
      "/programs",
      this.validateRequest("query", ListProgramSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.listPrograms(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/activities",
      this.validateRequest("query", ListActivitySchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.listActivity(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/stocks",
      this.validateRequest("query", ListStockSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.listStock(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
