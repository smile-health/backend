import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { FillingStockQueryParamsSchema } from "./filling-stock.schema.js"
import { FillingStockModule } from "./filling-stock.module.js"

export class FillingStockController extends BaseController {
  constructor(
    private readonly module: FillingStockModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("filling_stock")
  }

  getRoutes(): Hono {
    const router = new Hono()

    // Apply role-based access control - same as abnormal-stock
    router.use(
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.SATUSEHAT, DEVICE_TYPE.web],
      ])
    )

    // GET /review - Overview endpoint
    router.get(
      "/review",
      this.validateRequest("query", FillingStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getReview(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    // GET /material - Material-based analysis with pagination
    router.get(
      "/material",
      this.validateRequest("query", FillingStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getMaterial(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    // GET /entity - Entity-based analysis with pagination
    router.get(
      "/entity",
      this.validateRequest("query", FillingStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getEntity(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    // GET /entity-material - Entity-material cross-analysis
    router.get(
      "/entity-material",
      this.validateRequest("query", FillingStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getEntityMaterial(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    // GET /location - Location-based analysis with hierarchical logic
    router.get(
      "/location",
      this.validateRequest("query", FillingStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getLocation(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    // Export endpoints
    // GET /review/export - Export review data to Excel
    router.get(
      "/review/export",
      this.validateRequest("query", FillingStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getReviewExport(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    // GET /material/export - Export material data to Excel
    router.get(
      "/material/export",
      this.validateRequest("query", FillingStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getMaterialExport(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    // GET /entity/export - Export entity data to Excel
    router.get(
      "/entity/export",
      this.validateRequest("query", FillingStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getEntityExport(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    // GET /entity-material/export - Export entity-material data to Excel
    router.get(
      "/entity-material/export",
      this.validateRequest("query", FillingStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getEntityMaterialExport(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    // GET /location/export - Export location data to Excel
    router.get(
      "/location/export",
      this.validateRequest("query", FillingStockQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getLocationExport(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    return router
  }
}
