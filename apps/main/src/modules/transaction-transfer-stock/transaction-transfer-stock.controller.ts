import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { TransactionTransferStockModule } from "./transaction-transfer-stock.module.js"
import { SubmitTransferStockSchema } from "./transaction-transfer-stock.schema.js"
import { TransactionTransferStockMiddleware } from "./transaction-transfer-stock.middleware.js"

export class TransactionTransferStockController extends BaseController {
  constructor(
    private readonly module: TransactionTransferStockModule,
    private readonly middleware: TransactionTransferStockMiddleware,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("transaction_transfer_stock")
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

    router.post(
      "/transfer-stock",
      this.validateRequest(
        "json",
        SubmitTransferStockSchema,
        this.middleware.submit
      ),
      async (c) => {
        const body = c.req.valid("json")
        await this.module.submit(c, body)
        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    return router
  }
}
