import { ForbiddenError } from "@smile/lib/error.js"
import { createMiddleware } from "hono/factory"

export class RoleMiddleware {
  allow = (roles: number[]) => {
    return createMiddleware(async (c, next) => {
      const { roleId } = c.var

      if (!roles.includes(roleId)) {
        throw new ForbiddenError("Forbidden Access")
      }
      return next()
    })
  }
}
