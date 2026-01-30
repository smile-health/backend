import env from "@/config/env.js"
import { ActivityRepository } from "@/modules/activity/activity.repository.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { OrderIntegrationRepository } from "@/modules/order-integration/order-integration.repository.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { AuthKeycloakService } from "@smile-health/lib/api/auth.service.js"
import { ForbiddenError, UnauthorizedError } from "@smile-health/lib/error.js"
import { logger } from "@smile-health/lib/logger.js"
import { Workspace, WorkspaceConfig } from "@smile-health/lib/types/jwt.js"
import { collect } from "@smile-health/lib/utils.js"
import { Context, Next } from "hono"
import * as jwt from "jsonwebtoken"
import moment from "moment-timezone"
import { DEVICE_TYPE } from "../constants/device.js"

export class AuthMiddleware {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly entityRepo: EntityRepository,
    private readonly activityRepo: ActivityRepository
  ) {}

  public handle = async (c: Context, next: Next) => {
    try {
      const authHeader = c.req.header("Authorization")
      if (!authHeader) throw new UnauthorizedError()

      const token = authHeader?.split(" ")[1] ?? ""
      // Sync verification is faster but needs try-catch
      const payload = jwt.verify(token, env.APP_KEY)
      
      if (!payload["workspaces"]) throw new UnauthorizedError("Invalid Token")

      const workspaceID = c.req.header("x-program-id")
      c.set("deviceType", DEVICE_TYPE[Number(c.req.header("Device-Type"))])

      const timezoneHeader = c.req.header("Timezone") ?? ""
      const tz = moment.tz.zone(timezoneHeader) ? timezoneHeader : "Etc/UTC"
      c.set("timeZone", tz)

      if (!workspaceID) {
        const error = {
          message: "Invalid Program",
          type: "invalid_program",
        }
        return c.json(error, 403)
      }

      const workspace = (payload["workspaces"] as Workspace[]).find(
        (ws) => ws.id == Number(workspaceID)
      )

      if (!workspace) {
        throw new ForbiddenError("User tidak memiliki akses ke workspace")
      }
      c.set("programId", Number(workspaceID))
      c.set("config", workspace.config)

      // Parallel queries for better performance
      const [user, activities] = await Promise.all([
        this.userRepo.findOne(c, {
          global_id: Number(payload["account_id"]),
          program_id: workspaceID,
        }),
        this.activityRepo.find(c, {})
      ])

      if (!user || user.status == 0) {
        throw new ForbiddenError("User tidak aktif pada workspace ini")
      }
      c.set("userId", Number(user.id))
      c.set("roleId", payload["role"])
      c.set("entityId", user.entity_id!)
      c.set("activityIds", collect(activities, "id"))

      // Entity query depends on user result
      const userEntity = await this.entityRepo.findOne(c, { id: user.entity_id })
      if (!userEntity) {
        throw new ForbiddenError("User tidak memiliki entitas pada workspace ini")
      }
      c.set("userEntity", userEntity)

      await next()
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError("Invalid token")
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Token expired")
      }
      if (error instanceof jwt.NotBeforeError) {
        throw new UnauthorizedError("Token not active")
      }
      // Re-throw our custom errors
      if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
        throw error
      }
      // Log unexpected errors and return generic error
      logger.error({ err: error }, 'Unexpected auth error')
      throw new UnauthorizedError("Authentication failed")
    }
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
      const user = await this.userRepo.findOne(c, { id: c.var.userId })

      const payload = {
        account_id: user?.global_id,
      }

      const token = jwt.sign({ ...payload }, env.APP_KEY, { expiresIn: "7d" })
      c.req.raw.headers.set("Authorization", `Bearer ${token}`)
    } catch (error) {
      logger.error(`failed auth reinjection main: ${JSON.stringify(error)}`)
      return c.json({ message: c.var.t("auth.unauthorized") }, 401)
    }

    await next()
  }
}

export class AuthKeycloakMiddleware {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly entityRepo: EntityRepository,
    private readonly integrationRepo: OrderIntegrationRepository,
    private readonly authKeycloakService: AuthKeycloakService
  ) {}
  public handleAuthKeycloak = async (c: Context, next: Next) => {
    try {
      const authHeader = c.req.header("Authorization")
      const token = authHeader?.split(" ")[1]

      if (!token) {
        logger.error(`token not found in header: ${token} - ${authHeader}`)
        return c.json({ message: c.var.t("auth.unauthorized") }, 401)
      }

      const responseAuthKeycloak =
        await this.authKeycloakService.validateToken(token)

      const user = await this.userRepo.getUserWithWorkspaceByKeycloakId(
        c,
        responseAuthKeycloak?.userInfo?.sub
      )

      if (user.length == 0) {
        logger.error(`user not found`)
        return c.json({ message: c.var.t("auth.unauthorized") }, 401)
      }

      // handle client users (siha/sitb/din)
      const clientKey = Object.keys(
        responseAuthKeycloak?.userInfo?.resource_access
      ).filter((key) => key !== "account")[0]
      const client = await this.integrationRepo.getClientByKey(c, clientKey)

      // fill programId if not sent via headers only for client users
      if (client) {
        c.set("client", client)
        c.set("programId", c.var.programId ?? user[0]?.program_id)
      }

      const workspace = user.find(
        (ws) => ws.program_id == Number(c.var.programId)
      )

      if (!workspace) {
        return c.json({ message: c.var.t("auth.not_access_program") }, 403)
      }

      if (!workspace || workspace.status == 0) {
        return c.json({ message: c.var.t("auth.not_active_program") }, 403)
      }

      const programConfig = JSON.parse(
        JSON.stringify(workspace.program_config)
      ) as WorkspaceConfig

      c.set("user", workspace)
      c.set("userId", Number(workspace.id))
      c.set("roleId", workspace.role ?? 0)
      c.set("roles", responseAuthKeycloak?.userInfo?.realm_access?.roles)
      c.set("resource_access", responseAuthKeycloak?.userInfo?.resource_access)
      c.set("config", programConfig)
      c.set("token", token)
      c.set(
        "programIdUser",
        user.map((u) => u.program_id)
      )

      const activities = await this.activityRepo.find(c, {})

      const userEntity = await this.entityRepo.findOne(c, {
        id: workspace.entity_id,
      })
      if (!userEntity) {
        logger.error(`${c.var.t("auth.has_no_entitas_program")}`)
        return c.json({ message: c.var.t("auth.has_no_entitas_program") }, 401)
      }

      c.set("activityIds", collect(activities, "id"))
      c.set("entityId", workspace.entity_id)
      c.set("userEntity", userEntity)
      c.set("deviceType", DEVICE_TYPE[c.req.header("Device-Type") ?? "web"])

      const timezoneHeader = c.req.header("Timezone") ?? ""
      const tz = moment.tz.zone(timezoneHeader) ? timezoneHeader : "Etc/UTC"
      c.set("timeZone", tz)
    } catch (error) {
      logger.error(`failed auth main: ${JSON.stringify(error)}`)
      return c.json({ message: c.var.t("auth.unauthorized") }, 401)
    }

    await next()
  }
}
