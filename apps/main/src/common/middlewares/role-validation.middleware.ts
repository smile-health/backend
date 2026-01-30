import { DEVICE_TYPE } from "@/common/constants/device.js"
import { ForbiddenError } from "@smile-health/lib/error.js"
import { createMiddleware } from "hono/factory"
import { RolesToResourceMappingRepository } from "../repository/roles.repository.js"
import { RoleParams } from "../types/roles.js"

type Item = [number, number]

export class RoleMiddleware {
  allow = (roles: number[]) => {
    return createMiddleware(async (c, next) => {
      const { roleId } = c.var

      if (!roles.includes(roleId ?? -1)) {
        throw new ForbiddenError("Forbidden Access")
      }

      return next()
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

  handle = (repository: RolesToResourceMappingRepository) => {
    return createMiddleware(async (c, next) => {
      let { path } = c.req
      path = "/main" + path

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
}
