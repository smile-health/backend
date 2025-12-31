import { associate } from "@smile/lib/utils.js"
import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"

export class TargetGroupRepository extends BaseRepository<"target_groups"> {
  constructor() {
    super("target_groups")
  }

  async findAll(c: Context) {
    const result = await c.var.trx
      .selectFrom("target_groups")
      .select(["id", "title"])
      .where("is_active", "=", 1)
      .where("deleted_at", "is", null)
      .groupBy("title")
      .execute()

    return result
  }

  async getTargetGroupMapped(c: Context, targetGroupIds: number[]) {
    if (!targetGroupIds || targetGroupIds.length === 0) return {}

    const groups = await c.var.trx
      .selectFrom("target_groups")
      .selectAll()
      .where("id", "in", targetGroupIds)
      .execute()

    return associate(groups, "id")
  }

  async getStreamData(c: Context) {
    return c.var.trx
      .selectFrom("target_groups")
      .where("is_active", "=", 1)
      .where("deleted_at", "is", null)
      .select(["id", "title as name"])
      .orderBy("id", "asc")
      .stream()
  }
}
