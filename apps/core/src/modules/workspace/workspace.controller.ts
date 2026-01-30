import { RoleValidationMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { zValidator } from "@hono/zod-validator"
import { ValidationError } from "@smile-health/lib/error.js"
import { Hono } from "hono"
import { WorkspaceModule } from "./workspace.module.js"
import { GetWorkspacesParamsSchema } from "./workspace.schema.js"

export class WorkspaceController {
  constructor(
    private readonly module: WorkspaceModule,
    private readonly roleMiddleware: RoleValidationMiddleware
  ) { }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/",
      zValidator("query", GetWorkspacesParamsSchema, (result) => {
        if (!result.success) {
          throw new ValidationError(result.error.issues[0]?.message)
        }
      }),
      async (c) => {
        const q = c.req.valid("query")
        const result = await this.module.getList(c, q)
        return c.json(result, 200)
      }
    )

    return router
  }
}
