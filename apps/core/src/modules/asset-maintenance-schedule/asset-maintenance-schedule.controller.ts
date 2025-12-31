import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AssetMaintenanceScheduleModule } from "./asset-maintenance-schedule.module.js"
import { GetAssetMaintenanceSchedulePaginationSchema } from "./asset-maintenance-schedule.schema.js"

export class AssetMaintenanceScheduleController extends BaseController {
  constructor(private readonly module: AssetMaintenanceScheduleModule) {
    super("asset_maintenance_schedule")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest(
        "query",
        GetAssetMaintenanceSchedulePaginationSchema
      ),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.list(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}