import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { GetProvincesQueries } from "./province.schema.js"

export class ProvinceRepository {
  async getListProvince(c: Context<DB>, param: GetProvincesQueries) {
    const { page, paginate, keyword } = param
    const offset = (page - 1) * paginate
    let query = c.var.trx.selectFrom("locations").where("level", "=", 0)

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    const listProvince = await query
      .select(["id", "name"])
      .orderBy("id")
      .limit(paginate)
      .offset(offset)
      .execute()

    return listProvince
  }

  async getTotalCountProvince(c: Context<DB>, param: GetProvincesQueries) {
    const { keyword } = param
    let query = c.var.trx.selectFrom("locations").where("level", "=", 0)

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    const totalProvince = await query
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalProvince?.total) || 0
  }

  async findById(c: Context<DB>, id: string[]) {
    return await c.var.trx
      .selectFrom("locations")
      .selectAll()
      .where("id", "in", id)
      .where("level", "=", 0)
      .execute()
  }
}
