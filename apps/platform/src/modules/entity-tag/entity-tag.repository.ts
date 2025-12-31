import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { GetEntityTagsQueries } from "./entity-tag.schema.js"

export class EntityTagRepository {
  async getListEntityTag(c: Context<DB>, param: GetEntityTagsQueries) {
    const { page, paginate, keyword } = param
    const offset = (page - 1) * paginate
    let query = c.var.trx
      .selectFrom("entity_tags")
      .where("deleted_at", "is", null)

    if (keyword) {
      query = query.where("title", "like", `%${keyword}%`)
    }

    const listEntityTag = await query
      .select(["id", "title"])
      .orderBy("id")
      .limit(paginate)
      .offset(offset)
      .execute()

    return listEntityTag
  }

  async getTotalCountEntityTag(c: Context<DB>, param: GetEntityTagsQueries) {
    const { keyword } = param

    let query = c.var.trx
      .selectFrom("entity_tags")
      .where("deleted_at", "is", null)
    if (keyword) {
      query = query.where("title", "like", `%${keyword}%`)
    }

    const totalEntityTag = await query
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalEntityTag?.total) || 0
  }

  async findById(c: Context<DB>, id: number[]) {
    return await c.var.trx
      .selectFrom("entity_tags")
      .selectAll()
      .where("id", "in", id)
      .execute()
  }
}
