import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AssetInventoryModule } from "./asset-inventory.module.js"
import { AssetInventoryQueryParams, AssetInventoryQueryParamsSchema } from "./asset-inventory.schema.js"

export class AssetInventoryController extends BaseController {
  constructor(
    private readonly module: AssetInventoryModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("asset_inventory")
  }

  getRoutes(): Hono {
    const router = new Hono()

    // Apply role-based access control
    router.use(
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.SATUSEHAT, DEVICE_TYPE.web],
      ])
    )

    // GET /asset-inventory/overview
    router.get(
      "/overview",
      this.validateRequest("query", AssetInventoryQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query") as AssetInventoryQueryParams
        const response = await this.module.getAssetOwnershipOverview(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    // GET /asset-inventory/table
    router.get(
      "/table",
      this.validateRequest("query", AssetInventoryQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query") as AssetInventoryQueryParams
        const response = await this.module.getAssetOwnershipTable(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    // GET /asset-inventory/export
    router.get(
      "/export",
      this.validateRequest("query", AssetInventoryQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query") as AssetInventoryQueryParams
        const file = await this.module.exportAssetInventoryExcel(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    return router
  }
}
