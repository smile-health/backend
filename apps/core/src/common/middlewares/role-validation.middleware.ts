import { USER_ROLE } from "@/common/constants/users.js"
import { ForbiddenError, UnauthorizedError } from "@smile-health/lib/error.js"
import { Context, Next } from "hono"
import { createMiddleware } from "hono/factory"
import { RolesToResourceMappingRepository } from "../repository/roles.repository.js"
import { RoleParams } from "../types/roles.js"

export class RoleValidationMiddleware {
  onlySuperAdminOrAdmin = createMiddleware(async (c, next) => {
    const roleId = c.var.role

    if (roleId != USER_ROLE.SUPERADMIN && roleId != USER_ROLE.ADMIN) {
      throw new ForbiddenError(c.var.t("auth.forbidden"))
    }

    await next()
  })

  onlySuperAdmin = createMiddleware(async (c, next) => {
    const roleId = c.var.role

    if (!roleId || roleId !== USER_ROLE.SUPERADMIN) {
      throw new ForbiddenError(c.var.t("auth.forbidden"))
    }

    await next()
  })

  haveAccess = createMiddleware(async (c, next) => {
    const { accountID, role } = c.var
    const param = c.req.param("id")
    const roleAdmins = [USER_ROLE.SUPERADMIN, USER_ROLE.ADMIN]

    if (!roleAdmins.includes(role)) {
      if (accountID != Number(param)) {
        throw new UnauthorizedError(c.var.t("auth.unauthorized"))
      }
    }

    await next()
  })

  handle = (repository: RolesToResourceMappingRepository) => {
    return createMiddleware(async (c, next) => {
      let { path } = c.req
      path = "/core" + path

      const urlSegments = path.split("/").filter(Boolean) // Remove empty segments
      // Replace the segments in url path with ":id"
      for (const segment of urlSegments) {
        if (!isNaN(Number(segment))) {
          /*
           * Replace the segment in url path with ":id"
           * Before: /core/users/123/status
           * After: /core/users/:id/status
           */
          path = path.replace(segment, ":id")
        }
      }

      const { roles } = c.var
      const params: RoleParams = {
        route: path,
        resourceType: "be",
        method: c.req.raw.method.toLowerCase(),
      }

      const route = await repository.getDataRoutes(c, params)
      if (route) {
        const listRole = route.role_list
          ? route.role_list.split(",").map((item) => item.trim().toUpperCase())
          : []
        const isValidRole = roles?.some(
          (item: string) =>
            listRole.includes("PUBLIC") || listRole.includes(item.toUpperCase())
        )

        if (route.status === 0 || !isValidRole) {
          throw new ForbiddenError(c.var.t("auth.forbidden"))
        }
      }

      await next()
    })
  }

  public validateDeviceRole = async (c: Context, next: Next) => {
    await next()

    const user = c.var.user
    if (!user) {
      return
    }

    const { role, view_only } = user
    const deviceType = c.req.header("device-type")

    if (
      (deviceType === "web" || deviceType === "monitor") &&
      (role === USER_ROLE.OPERATOR || role === USER_ROLE.OPERATOR_COVID)
    ) {
      throw new UnauthorizedError(`${c.var.t("auth.allowed_mobile")}`)
    }

    switch (role) {
      case USER_ROLE.OPERATOR:
      case USER_ROLE.OPERATOR_COVID:
        if (deviceType === "mobile-dashboard" || deviceType !== "mobile") {
          throw new UnauthorizedError(`${c.var.t("auth.allowed_mobile")}`)
        }
        break

      case USER_ROLE.MANAGER:
      case USER_ROLE.MANAGER_COVID:
        if (view_only === 1 && deviceType === "mobile") {
          throw new UnauthorizedError(`${c.var.t("auth.allowed_web")}`)
        }
        break

      case USER_ROLE.CUSTOMER_CENTER:
      case USER_ROLE.SUPERADMIN:
      case USER_ROLE.ADMIN:
      case USER_ROLE.MANUFACTURE:
      case USER_ROLE.DISTRIBUTOR_COVID:
        if (deviceType === "mobile") {
          throw new UnauthorizedError(`${c.var.t("auth.allowed_web")}`)
        }
        break

      case USER_ROLE.THIRD_PARTY:
      case USER_ROLE.ASIK:
        if (deviceType === "mobile" || deviceType === "web") {
          throw new UnauthorizedError(`${c.var.t("auth.permitted")}`)
        }
        break

      case USER_ROLE.PKC:
        if (deviceType !== "mobile") {
          throw new UnauthorizedError(`${c.var.t("auth.permitted")}`)
        }
        break

      default:
        break
    }
  }
}
