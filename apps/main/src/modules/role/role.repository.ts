import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { associate } from "@smile-health/lib/utils.js"

export class RoleRepository {
  async getRoles(c: Context<DB>) {
    return await c.var.trx.selectFrom("roles").selectAll().execute()
  }

  async findByID(c: Context<DB>, roleID: number = 0) {
    return await c.var.trx
      .selectFrom("roles")
      .selectAll()
      .where("id", "=", roleID)
      .executeTakeFirstOrThrow()
  }

  async findByIDMapped(c: Context<DB>, roleIDs: number[]) {
    const roles = await c.var.trx
      .selectFrom("roles")
      .selectAll()
      .where("id", "in", roleIDs)
      .execute()

    return associate(roles, "id")
  }
}
