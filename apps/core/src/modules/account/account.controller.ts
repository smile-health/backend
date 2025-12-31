import { zValidator } from "@hono/zod-validator"
import { ValidationError } from "@smile/lib/error.js"
import { Hono } from "hono"
import { AccountMiddleware } from "./account.middleware.js"
import { AccountModule } from "./account.module.js"
import {
  ChangePasswordRequest,
  ChangePasswordSchema,
  LoginRequest,
} from "./account.schema.js"

export class AccountController {
  constructor(
    private readonly middleware: AccountMiddleware,
    private readonly module: AccountModule
  ) {}

  getRoutes(): Hono {
    const router = new Hono()

    router.post("/login", this.middleware.validateSchema, async (c) => {
      const req: LoginRequest = c.req.valid("json")
      const { ...resp } = await this.module.login(c, req)

      return c.json(resp, 200)
    })

    router.get("/workspaces", async (c) => {
      const workspaces = await this.module.getWorkspaces(c)
      return c.json({ workspaces }, 200)
    })

    router.get("/profile", async (c) => {
      const resp = await this.module.getProfile(c)
      return c.json(resp, 200)
    })

    router.post("/logout", async (c) => {
      await this.module.logout(c)
      return c.body(null, 204)
    })

    router.post(
      "/update-password",
      zValidator("json", ChangePasswordSchema, (result) => {
        if (!result.success) {
          throw new ValidationError(result.error.issues[0]?.message)
        }
      }),
      async (c) => {
        const data: ChangePasswordRequest = c.req.valid("json")
        await this.module.changePassword(c, data)
        return c.json({ status: true, message: "Change Password Success" })
      }
    )

    return router
  }
}
