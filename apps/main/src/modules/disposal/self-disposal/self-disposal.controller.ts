import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares/excel.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { SelfDisposalModule } from "./self-disposal.module.js"
import { SelfDisposalMiddleware } from "./self-disposal.middleware.js"
import {
  SelfDisposalSchema,
  SelfDisposalListPaginatedRequestSchema,
} from "./self-disposal.schema.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { DEVICE_TYPE } from "@/common/constants/device.js"

export class SelfDisposalController extends BaseController {
  constructor(
    private readonly module: SelfDisposalModule,
    private readonly middleware: SelfDisposalMiddleware,
    private readonly roleMiddleware: RoleMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("disposal")
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
      "/self-disposal",
      this.validateRequest("json", SelfDisposalSchema, (c, body) =>
        this.middleware.validateSelfDisposal(c, body)
      ),
      async (c) => {
        const body = c.req.valid("json")
        await this.module.selfDisposal(c, body)
        return c.body(null, StatusCodes.CREATED)
      }
    )

    router.get(
      "/self-disposal",
      this.validateRequest("query", SelfDisposalListPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.getDisposalList(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/self-disposal/xls",
      this.validateRequest("query", SelfDisposalListPaginatedRequestSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.exportExcel(c, query)
        c.set("file", file)
      }
    )

    return router
  }
}
