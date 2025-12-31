import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { GetRegenciesQueries } from "./regency.schema.js"

export class RegencyRepository {
  async getListRegency(c: Context<DB>, param: GetRegenciesQueries) {
    const { page, paginate, keyword, province_id } = param
    const offset = (page - 1) * paginate
    let query = c.var.trx.selectFrom("locations").where("level", "=", 1)

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    const listRegency = await query
      .where("parent_id", "in", province_id)
      .select(["id", "name"])
      .orderBy("id")
      .limit(paginate)
      .offset(offset)
      .execute()

    return listRegency
  }

  async getTotalCountRegency(c: Context<DB>, param: GetRegenciesQueries) {
    const { keyword, province_id } = param
    let query = c.var.trx.selectFrom("locations").where("level", "=", 1)

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    const totalRegency = await query
      .where("parent_id", "in", province_id)
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalRegency?.total) || 0
  }

  async findById(c: Context<DB>, id: string[]) {
    return await c.var.trx
      .selectFrom("locations")
      .selectAll()
      .where("id", "in", id)
      .where("level", "=", 1)
      .execute()
  }
}
