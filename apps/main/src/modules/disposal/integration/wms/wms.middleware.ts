import { UserRepository } from "@/modules/user/user.repository.js"
import { AuthKeycloakService } from "@smile-health/lib/api/auth.service.js"
import { logger } from "@smile-health/lib/logger.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { IntegrationRepository } from "../integration.repository.js"

export class WmsMiddleware {
  constructor(
    private readonly repo: IntegrationRepository,
    private readonly userRepo: UserRepository,
    private readonly authService: AuthKeycloakService
  ) {}

  public authorize = createMiddleware(async (c: Context, next) => {
    try {
      const authHeader = c.req.header("Authorization")
      const token = authHeader?.split(" ")[1]

      if (!token) {
        logger.error(`token not found in header: ${token} - ${authHeader}`)
        return c.json({ message: c.var.t("auth.unauthorized") }, 401)
      }

      const authResp = await this.authService.validateToken(token)
      const clientKey = Object.keys(authResp?.userInfo?.resource_access).filter(
        (key) => key !== "account"
      )[0]
      const client = await this.repo.getClientByKey(c, clientKey)

      // only wms user is allowed
      if (!client || client.key !== "wms") {
        return c.json({ message: c.var.t("auth.unauthorized") }, 401)
      }

      const user = await this.userRepo.getGlobalUserByKeycloakId(
        c,
        authResp?.userInfo?.sub
      )
      if (!user) {
        return c.json({ message: c.var.t("auth.unauthorized") }, 401)
      }

      c.set("userId", user.id)
      c.set("roles", authResp?.userInfo?.realm_access?.roles)
      c.set("resource_access", authResp?.userInfo?.resource_access)
      c.set("client", client)
    } catch (error) {
      logger.error(`failed auth main: ${JSON.stringify(error)}`)
      return c.json({ message: c.var.t("auth.token_expired") }, 401)
    }

    await next()
  })

  logRequest = createMiddleware(async (c: Context, next) => {
    await next()

    const { client, requestType } = c.var

    const res = c.res.clone()
    await this.repo.createLog({
      client_id: client?.id ?? 0,
      source_type: "disposal_instruction",
      flow: "in",
      tag: requestType ?? "cancel_bast",
      request: JSON.stringify({
        method: c.req.method,
        url: c.req.url,
        body: await c.req.text(),
      }),
      response: JSON.stringify({
        status: res.status,
        body: await res.text(),
        error: c.error,
      }),
    })
  })
}
