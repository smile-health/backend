import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AssetVendorTypeModule } from "./asset-vendor-type.module.js"
import { GetAssetVendorTypesPaginationSchema } from "./asset-vendor-type.schema.js"

export class AssetVendorTypeController extends BaseController {
  constructor(private readonly module: AssetVendorTypeModule) {
    super("asset_vendor_type")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", GetAssetVendorTypesPaginationSchema),
      async (c) => {
        const paramQuery = c.req.valid("query")
        const response = await this.module.list(c, paramQuery)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
