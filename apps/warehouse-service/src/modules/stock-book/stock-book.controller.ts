import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { Hono } from "hono"
import { StockBookModule } from "./stock-book.module.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { StockBookQueryParamsSchema } from "./stock-book.schema.js"
import { StatusCodes } from "http-status-codes"

export class StockBookController extends BaseController {
  constructor(
    private readonly stockBookModule: StockBookModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("stock_book")
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
      "/export",
      this.validateRequest("query", StockBookQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.stockBookModule.exportStockBookExcel(
          c,
          queryParams
        )

        return this.downloadExcel(c, file)
      }
    )

    router.get(
      "/export-all",
      this.validateRequest("query", StockBookQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.stockBookModule.exportAllStockkBookExcel(
          c,
          queryParams
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
