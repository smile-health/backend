import { RoleValidationMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EntityTagMiddleware } from "./entity-tag.middleware.js"
import { EntityTagModule } from "./entity-tag.module.js"

export class EntityTagController {
  constructor(
    private readonly module: EntityTagModule,
    private readonly middleware: EntityTagMiddleware,
    private readonly roleValidationMiddleware: RoleValidationMiddleware
  ) {}

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.middleware.queryValidation,
      async (c) => {
        const paramQuery = c.req.valid("query")
        const pages = await this.module.getEntityTags(c, paramQuery)

        return pages.total_item == 0
          ? c.body(null, StatusCodes.NO_CONTENT)
          : c.json(pages, StatusCodes.OK)
      }
    )

    return router
  }
}
