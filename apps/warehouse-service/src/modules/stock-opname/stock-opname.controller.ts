import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { Hono } from "hono"
import { StockOpnameModule } from "./stock-opname.module.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { StockOpnameQueryParamsSchema } from "./stock-opname.schema.js"
import { StatusCodes } from "http-status-codes"

export class StockOpnameController extends BaseController {
  constructor(
    private readonly stockOpnameModule: StockOpnameModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("stock_opname")
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
      "/compliance/summary",
      this.validateRequest("query", StockOpnameQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response =
          await this.stockOpnameModule.stockOpnameComplianceSummary(
            c,
            queryParams
          )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/compliance",
      this.validateRequest("query", StockOpnameQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.stockOpnameModule.stockOpnameCompliance(
          c,
          queryParams
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/compliance/export",
      this.validateRequest("query", StockOpnameQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const result = await this.stockOpnameModule.stockOpnameComplianceExport(
          c,
          queryParams
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/result/summary",
      this.validateRequest("query", StockOpnameQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.stockOpnameModule.stockOpnameResultSummary(
          c,
          queryParams
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/result",
      this.validateRequest("query", StockOpnameQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.stockOpnameModule.stockOpnameResult(
          c,
          queryParams
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/result/export",
      this.validateRequest("query", StockOpnameQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const result = await this.stockOpnameModule.stockOpnameResultExport(
          c,
          queryParams
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/materials",
      this.validateRequest("query", StockOpnameQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.stockOpnameModule.stockOpnameMaterial(
          c,
          queryParams
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/materials/export",
      this.validateRequest("query", StockOpnameQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const result = await this.stockOpnameModule.stockOpnameMaterialExport(
          c,
          queryParams
        )
        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
