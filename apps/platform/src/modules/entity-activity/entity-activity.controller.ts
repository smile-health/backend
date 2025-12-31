import { IdParamsSchema } from "@smile/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { USER_ROLE } from "@/common/constants/user.js"
import { BaseController } from "../base.controller.js"
import { EntityActivityModule } from "./entity-activity.module.js"
import { EntityActivityMiddleware } from "./entity-activity.middleware.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import {
  GetListEntityActivitySchema,
  SubmitEntityActivityRequestSchema,
} from "./entity-activity.schema.js"

export class EntityActivityController extends BaseController {
  constructor(
    private module: EntityActivityModule,
    private entityActivityMiddleware: EntityActivityMiddleware,
    private roleMiddleware: RoleMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.use(
      this.roleMiddleware.allow([USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN])
    )

    router.post(
      "/activities/submit-time",
      this.validateRequest("json", SubmitEntityActivityRequestSchema),
      this.entityActivityMiddleware.validateActivity,
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.submit(c, body)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id/activities",
      this.validateRequest("param", IdParamsSchema),
      this.validateRequest("query", GetListEntityActivitySchema),
      async (c) => {
        const param = c.req.valid("param")
        const query = c.req.valid("query")
        const response = await this.module.list(c, param.id, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
