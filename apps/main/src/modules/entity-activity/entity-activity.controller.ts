import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { IdParamsSchema } from "@smile-health/lib/types/param.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { EntityActivityMiddleware } from "./entity-activity.middleware.js"
import { EntityActivityModule } from "./entity-activity.module.js"
import {
  GetListEntityActivityAdditionalSchema,
  SubmitEntityActivityRequestSchema,
} from "./entity-activity.schema.js"

export class EntityActivityController extends BaseController {
  constructor(
    private readonly module: EntityActivityModule,
    private readonly entityActivityMiddleware: EntityActivityMiddleware,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

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
      this.validateRequest("query", GetListEntityActivityAdditionalSchema),
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
