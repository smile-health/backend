import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { RoleParams } from "../types/roles.js"

export class RolesToResourceMappingRepository {
  async getDataRoutes(c: Context<DB>, params: RoleParams) {
    const { route, resourceType, method } = params
    return c.var.trx
      .selectFrom("roles_to_resource_mapping")
      .where("route_handler", "=", route)
      .$if(resourceType === "be", (qb) => qb.where("http_method", "=", method!))
      .select(["role_list", "status"])
      .executeTakeFirst()
  }
}
