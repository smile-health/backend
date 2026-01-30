import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AssetInventoryModule } from "./asset-inventory.module.js"
import { AssetInventoryMiddleware } from "./asset-inventory.middleware.js"
import {
  UpdateAssetInventoryParamSchema,
  GetAssetInventoryParamSchema,
} from "./asset-inventory.schema.js"
import { ExcelMiddleware } from "@smile-health/lib/middlewares"
import { AssetInventoryService } from "./utils/asset-inventory.service.js"

export class AssetInventoryController extends BaseController {
  constructor(
    private readonly module: AssetInventoryModule,
    private readonly middleware: AssetInventoryMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("asset_inventory")
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get("/send-maintenance-notif", async (c) => {
      try {
        console.log("Processing maintenance notification request")

        const result = await new AssetInventoryService().sendMaintenanceReminder(c)
        return c.json(result, StatusCodes.OK)
      } catch (error) {
        console.error("Error in send-maintenance-notif endpoint:", error)

        return c.json(
          {
            error: "Failed to send maintenance notification",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      }
    })

    router.get("/send-calibration-notif", async (c) => {
      try {
        console.log("Processing calibration notification request")

        const result = await new AssetInventoryService().sendCalibrationReminder(c)

        return c.json(result, StatusCodes.OK)
      } catch (error) {
        console.error("Error in send-calibration-notif endpoint:", error)

        return c.json(
          {
            error: "Failed to send calibration notification",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      }
    })

    router.get("/send-warranty-notif", async (c) => {
      try {
        console.log("Processing warranty notification request")

        const result = await new AssetInventoryService().sendWarrantyReminder(c)

        return c.json(result, StatusCodes.OK)
      } catch (error) {
        console.error("Error in send-warranty-notif endpoint:", error)

        return c.json(
          {
            error: "Failed to send warranty notification",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      }
    })

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
      this.validateRequest("param", UpdateAssetInventoryParamSchema),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.update(c, Number(param.id), body)
        return c.json(undefined, StatusCodes.NO_CONTENT)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", UpdateAssetInventoryParamSchema),
      this.validateRequest("json", this.middleware.updateStatus),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.updateStatus(c, Number(param.id), body)
        return c.json(undefined, StatusCodes.NO_CONTENT)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", GetAssetInventoryParamSchema),
      this.middleware.detail,
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, Number(param.id))
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

    return router
  }
}
