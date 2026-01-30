import { DEVICE_TYPE } from "@/common/constants/headers.js"
import {
  ForbiddenError,
  HTTPError,
  UnauthorizedError,
} from "@smile-health/lib/error.js"
import { logger } from "@smile-health/lib/logger.js"
import { createMiddleware } from "hono/factory"

export class AuthMiddleware {
  handleAuthHeaderReinjection = createMiddleware(async (c, next) => {
    // This is a placeholder for the actual auth middleware
    // In a real implementation, this would validate tokens and set user info
    // c.var.user = { global_id: 1 }
    await next()
  })
}

export class AuthKeycloakMiddleware {
  handleAuthKeycloak = createMiddleware(async (c, next) => {
    // This is a placeholder for the actual Keycloak auth middleware
    // In a real implementation, this would validate Keycloak tokens
    try {
      const authHeader = c.req.header("Authorization")
      const programId = c.req.header("x-program-id") ?? -1
      if (!authHeader) throw new UnauthorizedError()

      logger.info(`Token Auth: ${authHeader}`)

      const responseProfile = await fetch(
        process.env.CORE_API_URL + "/account/profile",
        {
          method: "GET",
          headers: {
            Authorization: authHeader,
            'Connection': 'keep-alive',
          },
        }
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await responseProfile.json()

      if (!responseProfile.ok) {
        logger.info(
          `Failed Request Get Profile ( Core ): ${responseProfile.ok} - ${responseProfile.status} - ${JSON.stringify(data)}`
        )
        throw new ForbiddenError(data!.message)
      }

      logger.info(
        `Success Request Get Profile ( Core ): ${data} - ${JSON.stringify(data)}`
      )

      c.set("programId", Number(programId))
      c.set("deviceId", DEVICE_TYPE[c.req.header("Device-Type") ?? "web"])
      c.set("roleId", data.role_id)
      c.set("language", c.req.header("Accept-Language") ?? "en")
      c.set("user", data)
    } catch (error: unknown) {
      if (error instanceof HTTPError) {
        throw error
      }
      logger.error(
        `Failed Request Get Profile ( Core ): ${JSON.stringify(error)}`
      )
      throw new ForbiddenError("Failed Get Profile")
    }
    await next()
  })
}
