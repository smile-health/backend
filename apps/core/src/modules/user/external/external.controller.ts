import { BaseController } from "@smile-health/lib/base/controller"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { profile, UserQueriesSchema } from "../user.schema"
import { UserExternalModule } from "./external.module"

export class UserExternalController extends BaseController {
  constructor(private readonly module: UserExternalModule) {
    super("user_external")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      this.validateRequest("query", UserQueriesSchema),
      async (c) => {
        const q = c.req.valid("query")
        const result = await this.module.list(c, q)
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get("/:id", this.validateRequest("param", profile), async (c) => {
      const params = c.req.valid("param")
      const result = await this.module.detail(c, params)
      return c.json(result)
    })

    return router
  }
}
