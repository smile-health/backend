import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import {
  InventoryOverviewQueryParamsSchema,
  StockMaterialQueryParamsSchema,
  MaterialEntityQueryParamsSchema,
  TemperatureOverviewQueryParamsSchema,
} from "./inventory-overview.schema.js"
import { InventoryOverviewModule } from "./inventory-overview.module.js"

export class InventoryOverviewController extends BaseController {
  constructor(
    private readonly module: InventoryOverviewModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("inventory_overview")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.use(
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.SATUSEHAT, DEVICE_TYPE.web],
      ])
    )

    router.get(
      "/stocks/overview",
      this.validateRequest("query", InventoryOverviewQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getStocksOverview(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/stocks/location",
      this.validateRequest("query", InventoryOverviewQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getStocksLocation(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/stocks/materials",
      this.validateRequest("query", StockMaterialQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getStocksMaterials(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/stocks/materials/entities",
      this.validateRequest("query", MaterialEntityQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getMaterialEntities(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/activities/overview",
      this.validateRequest("query", InventoryOverviewQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getActivitiesOverview(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/activities/location",
      this.validateRequest("query", InventoryOverviewQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getActivitiesLocation(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/temperatures/overview",
      this.validateRequest("query", TemperatureOverviewQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getTemperaturesOverview(
          c,
          queryParams
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/temperatures/location",
      this.validateRequest("query", TemperatureOverviewQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getTemperaturesLocation(
          c,
          queryParams
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
