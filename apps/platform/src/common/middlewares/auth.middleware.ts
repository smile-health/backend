import env from "@/config/env.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { ForbiddenError, UnauthorizedError } from "@smile/lib/error.js"
import { logger } from "@smile/lib/logger.js"
import { Workspace } from "@smile/lib/types/jwt.js"
import { Context, Next } from "hono"
import * as jwt from "jsonwebtoken"

export class AuthMiddleware {
  constructor(private readonly userRepo: UserRepository) {}

  public handle = async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization")
    if (!authHeader) throw new UnauthorizedError()

    const token = authHeader?.split(" ")[1] ?? ""
    const payload = jwt.verify(token, env.APP_KEY, (err, payload) => {
      if (err) throw new ForbiddenError()
      return payload
    })
    if (!payload["workspaces"]) throw new UnauthorizedError("Invalid Token")

    const workspaceID = env.WORKSPACE_ID

    const workspace = (payload["workspaces"] as Workspace[]).find(
      (ws) => ws.id == workspaceID
    )

    if (!workspace) {
      throw new ForbiddenError("User tidak memiliki akses ke workspace")
    }

    const user = await this.userRepo.findUserByGlobalID(
      c,
      Number(payload["account_id"])
    )

    if (!user || user.status == 0) {
      throw new ForbiddenError("User tidak aktif pada workspace ini")
    }

    c.set("workspaceId", workspaceID)
    c.set("userId", user.id)
    c.set("config", workspace.config)
    c.set("roleId", payload["role"])

    await next()
  }

  public checkUserFromCore = async (c: Context, next: Next) => {
    try {
      const authHeader = c.req.header("Authorization")
      if (!authHeader) throw new UnauthorizedError()

      logger.info(`Token Auth: ${authHeader}`)

      const responseProfile = await fetch(
        process.env.CORE_API_URL + "/account/profile",
        {
          method: "GET",
          headers: {
            Authorization: authHeader,
          },
        }
      )

      const data: any = await responseProfile.json()

      if (!responseProfile.ok) {
        logger.info(
          `Failed Request Get Profile ( Core ): ${responseProfile.ok} - ${responseProfile.status} - ${JSON.stringify(data)}`
        )
        throw new ForbiddenError(data!.message)
      }

      const payload = {
        account_id: data?.id,
      }
      const token = jwt.sign(payload, env.APP_KEY, { expiresIn: "7d" })
      c.req.raw.headers.set("Authorization", `Bearer ${token}`)
      logger.info(
        `Success Request Get Profile ( Core ): ${data?.id} - ${JSON.stringify(data)}`
      )
    } catch (error) {
      logger.error(
        `Failed Request Get Profile ( Core ): ${JSON.stringify(error)}`
      )
      throw new ForbiddenError("Failed Get Profile")
    }

    await next()
  }
}
