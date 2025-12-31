import { RoleValidationMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EntityTypeMiddleware } from "./entity-type.middleware.js"
import { EntityTypeModule } from "./entity-type.module.js"

export class EntityTypeController {
  constructor(
    private readonly module: EntityTypeModule,
    private readonly entityTypeMiddleware: EntityTypeMiddleware,
    private readonly roleValidationMiddleware: RoleValidationMiddleware
  ) {}

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/",
      this.entityTypeMiddleware.queryValidation,
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.getEntityTypePage(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
