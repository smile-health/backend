import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AssetElectricityModule } from "./asset-electricity.module.js"
import { GetAssetElectricityPaginationSchema } from "./asset-electricity.schema.js"

export class AssetElectricityController extends BaseController {
  constructor(private readonly module: AssetElectricityModule) {
    super("asset_electricity")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetAssetElectricityPaginationSchema),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.list(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}