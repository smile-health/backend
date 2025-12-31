import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares"
import { PaginationQueriesSchema } from "@smile/lib/types/paginate.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { OrderMiddleware } from "./order.middleware.js"
import { OrderModule } from "./order.module.js"
import {
  GetDetailOrderSchema,
  GetListOrderSchema,
  GetStatusCountSchema,
} from "./order.schema.js"

export class OrderController extends BaseController {
  constructor(
    private readonly module: OrderModule,
    private readonly middleware: OrderMiddleware,
    private readonly roleMiddleware: RoleMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("order")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetListOrderSchema),
      this.middleware.validateDateRange,
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/counts",
      this.validateRequest("query", GetStatusCountSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.count(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get("/delivery-types", async (c) => {
      const response = await this.module.listDeliveryType(c)
      return c.json(response, StatusCodes.OK)
    })

    router.post(
      "/request",
      this.validateRequest("json", this.middleware.createSchema),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.create(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", GetListOrderSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.export(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
        [USER_ROLE.MANUFACTURE, DEVICE_TYPE.web],
      ]),
      this.validateRequest("param", GetDetailOrderSchema),
      this.middleware.detail,
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, param.id)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id/var/xls",
      this.validateRequest("param", IdParamsSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const param = c.req.valid("param")
        const file = await this.module.exportVAR(c, param.id)
        c.set("file", file)
      }
    )

    router.get(
      "/:id/sbbk/xls",
      this.validateRequest("param", IdParamsSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const param = c.req.valid("param")
        const file = await this.module.exportSBBK(c, param.id)
        c.set("file", file)
      }
    )

    router.get(
      "/:id/nota-batch/xls",
      this.validateRequest("param", IdParamsSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const param = c.req.valid("param")
        const file = await this.module.exportNotaBatch(c, param.id)
        c.set("file", file)
      }
    )

    router.get(
      "/:id/nota-confirmation/xls",
      this.validateRequest("param", IdParamsSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const param = c.req.valid("param")
        const file = await this.module.exportNotaConfirmation(c, param.id)
        c.set("file", file)
      }
    )

    router.get(
      "/:id/request-letter/xls",
      this.validateRequest("param", IdParamsSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const param = c.req.valid("param")
        const file = await this.module.exportRequestLetter(c, param.id)
        c.set("file", file)
      }
    )

    router.get(
      "/:id/integration-logs",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("query", PaginationQueriesSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const { page, paginate } = c.req.valid("query")
        const response = await this.module.getIntegrationLogs(
          c,
          id,
          page,
          paginate
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/:id/retry-integration-logs",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
      ]),
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const { id } = c.req.valid("param")
        const response = await this.module.retryIntegrationLogs(c, id)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
