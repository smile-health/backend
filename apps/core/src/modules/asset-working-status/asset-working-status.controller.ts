import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AssetWorkingStatusModule } from "./asset-working-status.module.js"
import { GetAssetWorkingStatusPaginationSchema } from "./asset-working-status.schema.js"

export class AssetWorkingStatusController extends BaseController {
  constructor(private readonly module: AssetWorkingStatusModule) {
    super("asset_working_status")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetAssetWorkingStatusPaginationSchema),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.list(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}