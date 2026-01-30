import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AssetCalibrationScheduleModule } from "./asset-calibration-schedule.module.js"
import { GetAssetCalibrationSchedulePaginationSchema } from "./asset-calibration-schedule.schema.js"

export class AssetCalibrationScheduleController extends BaseController {
  constructor(private readonly module: AssetCalibrationScheduleModule) {
    super("asset_calibration_schedule")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest(
        "query",
        GetAssetCalibrationSchedulePaginationSchema
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