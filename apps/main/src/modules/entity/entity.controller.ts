import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares/excel.middleware.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EntityTemplate } from "./entity.excel.js"
import { EntityMiddleware } from "./entity.middleware.js"
import { EntityModule } from "./entity.module.js"
import {
  GetInactiveEntityNotificationSchema,
  GetListEntitySchema,
  UpdateStatusEntityRequestSchema,
  UpdateStatusVendorEntityRequestSchema,
} from "./entity.schema.js"

export class EntityController extends BaseController {
  constructor(
    private readonly module: EntityModule,
    private readonly excelMiddleware: ExcelMiddleware,
    private readonly roleMiddleware: RoleMiddleware,
    private readonly entityMiddleware: EntityMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/send-inactive-entity-notif",
      this.validateRequest("query", GetInactiveEntityNotificationSchema),
      async (c) => {
        try {
          const query = c.req.valid("query")
          const response = await this.module.triggerInactiveEntityNotification(
            c,
            query
          )
          return c.json(response, StatusCodes.OK)
        } catch (error) {
          return c.json(
            {
              error: "Failed to send inactive entity notification",
              message: error instanceof Error ? error.message : "Unknown error",
            },
            StatusCodes.INTERNAL_SERVER_ERROR
          )
        }
      }
    )

    router.post(
      "/xls",
      this.excelMiddleware.validateFileMiddleware,
      this.validateExcelRequest(
        this.entityMiddleware.import,
        new EntityTemplate(),
        this.entityMiddleware.validateImport
      ),
      async (c) => {
        const rows = c.req.valid("json")
        const result = await this.module.import(c, rows)
        return c.json(
          {
            status: true,
            message: `Successfully imported ${result} rows`,
          },
          StatusCodes.OK
        )
      }
    )

    router.get(
      "/xls-template",
      this.excelMiddleware.handleExport,
      async (c) => {
        const template = await this.module.getTemplate(c)
        c.set("file", template)
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", GetListEntitySchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.export(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", UpdateStatusEntityRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const reqBody = c.req.valid("json")
        const response = await this.module.updateStatus(c, param.id, reqBody)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/status/vendors",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("json", UpdateStatusVendorEntityRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const reqBody = c.req.valid("json")
        const response = await this.module.updateStatusVendor(
          c,
          param.id,
          reqBody
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", IdParamsSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, param.id)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", GetListEntitySchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
