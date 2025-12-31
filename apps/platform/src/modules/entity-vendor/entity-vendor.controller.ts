import { IdParamsSchema } from "@smile/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { BaseController } from "../base.controller.js"
import { EntityVendorModule } from "./entity-vendor.module.js"
import { GetListEntityVendorSchema } from "./entity-vendor.schema.js"

export class EntityVendorController extends BaseController {
  constructor(
    private module: EntityVendorModule,
    private roleMiddleware: RoleMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.use(
      this.roleMiddleware.allow([USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN])
    )

    router.get(
      "/:id/vendors",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("query", GetListEntityVendorSchema),
      async (c) => {
        const param = c.req.valid("param")
        const query = c.req.valid("query")
        const response = await this.module.list(c, query, param.id)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
