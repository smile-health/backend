import { BaseController } from "@smile-health/lib/base/controller.js"
import { Context, Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AssetMonitoringDeviceModule } from "./asset-monitoring-device.module.js"
import { AssetMonitoringDeviceMiddleware } from "./asset-monitoring-device.middleware.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares"
import {
  GetAssetMonitoringDeviceParamSchema,
  UpdateAssetMonitoringDeviceParamSchema,
  UpdateAssetMonitoringDeviceStatusSchema,
} from "./asset-monitoring-device.schema.js"

export class AssetMonitoringDeviceController extends BaseController {
  constructor(
    private readonly module: AssetMonitoringDeviceModule,
    private readonly middleware: AssetMonitoringDeviceMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("asset_monitoring_device")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/xls",
      this.validateRequest("query", this.middleware.export),
      this.excelMiddleware.handleExport,
      async (c) => {
        const paramQuery = c.req.valid("query")
        const file = await this.module.export(c, paramQuery)
        c.set("file", file)
      }
    )

    router.post(
      "/",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.create(c, body)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.put(
      "/:id",
      this.validateRequest("param", UpdateAssetMonitoringDeviceParamSchema),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.update(c, Number(param.id), body)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.delete(
      "/:id",
      this.validateRequest("param", this.middleware.delete),
      async (c) => {
        const param = c.req.valid("param")
        await this.module.delete(c, Number(param.id))
        return c.json(
          { message: "Asset Monitoring Device deleted successfully" },
          StatusCodes.OK
        )
      }
    )

    router.delete(
      "/",
      this.validateRequest("json", this.middleware.bulkDelete),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.bulkDelete(c, body.ids)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", this.middleware.list),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.list(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/rtmd-statuses",
      this.validateRequest("query", this.middleware.list),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.getStatusList(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", GetAssetMonitoringDeviceParamSchema),
      this.validateRequest("json", UpdateAssetMonitoringDeviceStatusSchema),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.updateStatus(c, Number(param.id), body.status)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", GetAssetMonitoringDeviceParamSchema),
      this.middleware.detail,
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, Number(param.id))
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id/ops",
      this.validateRequest("param", GetAssetMonitoringDeviceParamSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.getAssetMonitoringDeviceInventoryOperations(
          c,
          Number(param.id)
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get("/health", async (c: Context) => {
      return c.json(
        {
          message: "Asset Monitoring Device API is healthy",
          status: StatusCodes.OK,
          timestamp: new Date().toISOString(),
          version: "1.0.0",
        },
        StatusCodes.OK
      )
    })

    return router
  }

  private handleError(c: Context, error: unknown) {

    if (error instanceof Error) {
      const statusCode = this.getStatusCodeFromError(error)
      return c.json(
        {
          error: {
            message: error.message,
            type: error.constructor.name,
          },
        },
        statusCode as 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500
      )
    }

    return c.json(
      {
        error: {
          message: "Internal server error",
          type: "InternalServerError",
        },
      },
      StatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  private getStatusCodeFromError(error: Error): StatusCodes {
    const errorName = error.constructor.name

    switch (errorName) {
      case "ValidationError":
        return StatusCodes.BAD_REQUEST
      case "NotFoundError":
        return StatusCodes.NOT_FOUND
      case "UnauthorizedError":
        return StatusCodes.UNAUTHORIZED
      case "ForbiddenError":
        return StatusCodes.FORBIDDEN
      case "ConflictError":
        return StatusCodes.CONFLICT
      case "BadRequestError":
        return StatusCodes.BAD_REQUEST
      default:
        return StatusCodes.INTERNAL_SERVER_ERROR
    }
  }
}
