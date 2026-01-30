import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { ForbiddenError } from "@smile-health/lib/error.js"
import { createMiddleware } from "hono/factory"

type Item = [number, number]

export class RoleMiddleware {
  handle = (repo) => {
    return createMiddleware(async (c, next) => {
      // This is a placeholder for role validation middleware
      // In a real implementation, this would check user roles and permissions
      await next()
    })
  }

  allowWithDeviceType = (roles: Item[]) => {
    return createMiddleware(async (c, next) => {
      const { roleId } = c.var
      const deviceType = c.req.header("device-type") ?? "web"

      const roleList = roles
        .filter((item) => item[1] === DEVICE_TYPE[deviceType])
        .map((item) => item[0])

      if (!roleList.includes(roleId ?? -1)) {
        throw new ForbiddenError("Forbidden Access")
      }
      return next()
    })
  }
}
