import { Context } from "hono"
import { USER_ROLE } from "@/common/constants/role.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { Hono, Context } from "hono"
import { TransactionListModule } from "./transaction-list.module.js"
import { TransactionListPaginatedRequestSchema } from "./transaction-list.schema.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { StatusCodes } from "http-status-codes"
import { DEVICE_TYPE } from "@/common/constants/headers.js"

export class TransactionListController extends BaseController {
  constructor(
    private readonly module: TransactionListModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("transaction_list")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.use(
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.SATUSEHAT, DEVICE_TYPE.web],
      ])
    )

    router.get(
      "/",
      this.validateRequest("query", TransactionListPaginatedRequestSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getTransactionList(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}