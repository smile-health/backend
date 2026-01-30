import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { EducationModule } from "./education.module.js"
import { EducationPaginatedRequestSchema } from "./education.schema.js"

export class EducationController extends BaseController {
  constructor(private readonly module: EducationModule) {
    super("educations")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", EducationPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
