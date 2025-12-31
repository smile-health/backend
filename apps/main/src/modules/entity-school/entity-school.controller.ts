import { Hono } from "hono"
import { BaseController } from "../base.controller.js"
import { EntitySchoolModule } from "./entity-school.module.js"
import { EntitySchoolPaginatedRequestSchema } from "./entity-school.schema.js"
import { StatusCodes } from "http-status-codes"

export class EntitySchoolController extends BaseController {
  constructor(private readonly module: EntitySchoolModule) {
    super()
  }

  public getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", EntitySchoolPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")

        const response = await this.module.list(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
