import env from "@/config/env.js"
import { AccountRepository } from "@/modules/account/account.repository.js"
import { IntegrationRepository } from "@/modules/integration/integration.repository"
import { UserRepository } from "@/modules/user/user.repository.js"
import { AuthKeycloakService } from "@smile-health/lib/api"
import { logger } from "@smile-health/lib/logger.js"
import { Context, Next } from "hono"
import * as jwt from "jsonwebtoken"
import { DEVICE_TYPE } from "../constants/device"

const whitelistedPaths = ["/account/login", "/users/validate-exists"]

export class AuthMiddleware {
  constructor(private readonly accountRepo: AccountRepository) {}

  public handle = async (c: Context, next: Next) => {
    if (whitelistedPaths.includes(c.req.path)) {
      return next()
    }

    try {
      const authHeader = c.req.header("Authorization")
      const token = authHeader?.split(" ")[1] ?? ""
      const secret = env.APP_KEY
      const payload = jwt.verify(token, secret)
      const account = await this.accountRepo.findByID(c, payload["account_id"])

      if (account.token_login != token) {
        return c.json({ message: c.var.t("auth.token_expired") }, 401)
      }

      c.set("user", account)
      c.set("accountID", account.id)
      c.set("role", payload["role"])
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return c.json({ message: c.var.t("auth.unauthorized") }, 401)
      }
      if (error instanceof jwt.TokenExpiredError) {
        return c.json({ message: c.var.t("auth.token_expired") }, 401)
      }
      if (error instanceof jwt.NotBeforeError) {
        return c.json({ message: c.var.t("auth.unauthorized") }, 401)
      }
      // Log unexpected errors
      logger.error({ err: error }, 'Unexpected auth error in core')
      return c.json({ message: c.var.t("auth.unauthorized") }, 401)
    }

    await next()
  }

  /**
   * This function as an auth header (token) reinjection since we need the regular
   * token (withouth keycloak) to publish event to sync service
   *
   * @param c Hono Context
   * @param next Next
   * @returns
   */
  public handleAuthHeaderReinjection = async (c: Context, next: Next) => {
    if (c.req.path == "/account/login") {
      return next()
    }

    try {
      const payload = {
        account_id: c.var.accountID,
      }

      const token = jwt.sign(payload, env.APP_KEY, { expiresIn: "7d" })
      c.req.raw.headers.set("Authorization", `Bearer ${token}`)
    } catch (error) {
      console.log(error)
      return c.json({ message: c.var.t("auth.unauthorized") }, 401)
    }

    await next()
  }
}

export class AuthKeycloakMiddleware {
  constructor(
    private readonly authKeycloakService: AuthKeycloakService,
    private readonly userRepo: UserRepository,
    private readonly integrationRepo: IntegrationRepository
  ) {}
  public handleAuthKeycloak = async (c: Context, next: Next) => {
    if (whitelistedPaths.includes(c.req.path)) {
      return next()
    }

    try {
      const authHeader = c.req.header("Authorization")
      const token = authHeader?.split(" ")[1]

      if (!token) {
        logger.error(`token not found in header: ${token} - ${authHeader}`)
        return c.json({ message: c.var.t("auth.unauthorized") }, 401)
      }

      const responseAuthKeycloak =
        await this.authKeycloakService.validateToken(token)

      const user = await this.userRepo.findOne(c, {
        username: responseAuthKeycloak?.userInfo?.preferred_username,
      })

      if (!user || user.status == 0) {
        return c.json({ message: c.var.t("auth.account_inactive") }, 403)
      }

      const clientKey = Object.keys(
        responseAuthKeycloak?.userInfo?.resource_access
      ).filter((key) => key !== "account")[0]
      const client = await this.integrationRepo.getClientByKey(c, clientKey)
      if (client) {
        c.set("client", client)
      }

      // sync keycloak uuid to our db
      const keycloakUuid = responseAuthKeycloak?.userInfo?.sub
      if (user.keycloak_uuid !== keycloakUuid) {
        await this.userRepo.update(
          c,
          { keycloak_uuid: keycloakUuid },
          { id: user.id }
        )
      }

      // used to fill created_by and updated_by on workspace related table
      const mapWsUserId = await this.userRepo.getMapProgramUserId(c, user.id)

      c.set("mapWsUserId", mapWsUserId)
      c.set("user", user)
      c.set("role", user?.role ?? 0)
      c.set("accountID", user.id)
      c.set("entityId", user.entity_id)
      c.set("roles", responseAuthKeycloak?.userInfo?.realm_access?.roles)
      c.set("resource_access", responseAuthKeycloak?.userInfo?.resource_access)
      c.set("token", token)
      c.set("deviceType", DEVICE_TYPE[c.req.header("Device-Type") ?? "web"])
    } catch (error) {
      logger.error(`failed auth core: ${JSON.stringify(error)}`)
      return c.json({ message: c.var.t("auth.unauthorized") }, 401)
    }

    await next()
  }
}
