import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { IdParamsSchema } from "@smile/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { EntityUserModule } from "./entity-user.module.js"
import { GetListEntityUserSchema } from "./entity-user.schema.js"

export class EntityUserController extends BaseController {
  constructor(
    private module: EntityUserModule,
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
      "/:id/users",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("query", GetListEntityUserSchema),
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
