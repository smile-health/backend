import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { GetVillagesQueries } from "./village.schema.js"

export class VillageRepository {
  async getListVillage(c: Context<DB>, param: GetVillagesQueries) {
    const { page, paginate, keyword, sub_district_id } = param
    const offset = (page - 1) * paginate
    let query = c.var.trx.selectFrom("locations").where("level", "=", 3)

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    const listVillage = await query
      .where("parent_id", "in", sub_district_id)
      .select(["id", "name"])
      .orderBy("id")
      .limit(paginate)
      .offset(offset)
      .execute()

    return listVillage
  }

  async getTotalCountVillage(c: Context<DB>, param: GetVillagesQueries) {
    const { keyword, sub_district_id } = param
    let query = c.var.trx.selectFrom("locations").where("level", "=", 3)

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    const totalVillage = await query
      .where("parent_id", "in", sub_district_id)
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalVillage?.total) || 0
  }

  async findById(c: Context<DB>, id: string[]) {
    return await c.var.trx
      .selectFrom("locations")
      .selectAll()
      .where("id", "in", id)
      .where("level", "=", 3)
      .execute()
  }
}
