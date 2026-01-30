import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EventReportMiddleware } from "./event-report.middleware.js"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import { EventReportModule } from "./event-report.module.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares"
import { GetListEventReportSchema } from "./event-report.schema.js"

export class EventReportController extends BaseController {
  constructor(
    private readonly eventReportMiddleware: EventReportMiddleware,
    private readonly module: EventReportModule,
    private readonly roleMiddleware: RoleMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("event-report")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest(
        "json",
        this.eventReportMiddleware.createSchemaEventReport
      ),
      async (c) => {
        const body = c.req.valid("json")
        const result = await this.module.create(c, body)
        return c.json(result, StatusCodes.CREATED)
      }
    )

    router.get(
      "/",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("query", GetListEventReportSchema),
      async (c) => {
        const query = c.req.valid("query")
        const result = await this.module.list(c, query)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/xls",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("query", GetListEventReportSchema),
      this.excelMiddleware.handleExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.export(c, query)
        c.set("file", file)
      }
    )

    router.put(
      "/:id",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest(
        "json",
        this.eventReportMiddleware.updateSchemaEventReport
      ),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const result = await this.module.update(c, param.id, body)
        return c.json(result, StatusCodes.UPDATED)
      }
    )

    router.put(
      "/:id/link",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest(
        "json",
        this.eventReportMiddleware.updateSchemaEventReportLink
      ),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const result = await this.module.updateLink(c, param.id, body)
        return c.json(result, StatusCodes.UPDATED)
      }
    )

    router.get(
      "/status-count",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const result = await this.module.statusCount(c)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
      ]),
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const param = c.req.valid("param")
        const result = await this.module.detail(c, param.id)
        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
