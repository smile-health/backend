import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { SmileVsAsikModule } from "./smile-vs-asik.module.js"
import { SmileVsAsikQueryParamsSchema } from "./smile-vs-asik.schema.js"

export class SmileVsAsikController extends BaseController {
  constructor(
    private readonly module: SmileVsAsikModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("smile_vs_asik")
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
      "/review",
      this.validateRequest("query", SmileVsAsikQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getReview(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/table",
      this.validateRequest("query", SmileVsAsikQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getTable(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/export",
      this.validateRequest("query", SmileVsAsikQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getExport(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    return router
  }
}
