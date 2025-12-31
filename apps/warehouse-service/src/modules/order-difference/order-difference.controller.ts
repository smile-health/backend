import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { OrderDifferenceModule } from "./order-difference.module.js"
import { OrderDifferenceQueryParamsSchema } from "./order-difference.schema.js"

export class OrderDifferenceController extends BaseController {
  constructor(
    private readonly module: OrderDifferenceModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("order_difference")
  }

  getRoutes(): Hono {
    const router = new Hono()

    // Apply role-based access control - same as old codebase
    router.use(
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.SATUSEHAT, DEVICE_TYPE.web],
      ])
    )

    // GET /review - Overview endpoint (replaces /all from old codebase)
    router.get(
      "/review",
      this.validateRequest("query", OrderDifferenceQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getReview(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    // GET /material - Material-based analysis with pagination
    router.get(
      "/material",
      this.validateRequest("query", OrderDifferenceQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getMaterial(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    // GET /entity - Entity-based analysis with pagination
    router.get(
      "/entity",
      this.validateRequest("query", OrderDifferenceQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const response = await this.module.getEntity(c, queryParams)
        return c.json(response, StatusCodes.OK)
      }
    )

    // GET /location - Location-based analysis with pagination
    router.get(
      "/location",
      this.validateRequest("query", OrderDifferenceQueryParamsSchema),
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
      this.validateRequest("query", OrderDifferenceQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getReviewExport(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    // GET /material/export - Export material data to Excel
    router.get(
      "/material/export",
      this.validateRequest("query", OrderDifferenceQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getMaterialExport(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    // GET /entity/export - Export entity data to Excel
    router.get(
      "/entity/export",
      this.validateRequest("query", OrderDifferenceQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getEntityExport(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    // GET /location/export - Export location data to Excel
    router.get(
      "/location/export",
      this.validateRequest("query", OrderDifferenceQueryParamsSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const file = await this.module.getLocationExport(c, queryParams)
        return this.downloadExcel(c, file)
      }
    )

    return router
  }
}
