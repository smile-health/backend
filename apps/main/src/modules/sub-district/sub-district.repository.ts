import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { GetSubDistrictsQueries } from "./sub-district.schema.js"

export class SubDistrictRepository {
  async getListSubDistrict(c: Context<DB>, param: GetSubDistrictsQueries) {
    const { page, paginate, keyword, regency_id } = param
    const offset = (page - 1) * paginate
    let query = c.var.trx.selectFrom("locations").where("level", "=", 2)

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    const listSubDistrict = await query
      .where("parent_id", "in", regency_id)
      .select(["id", "name"])
      .orderBy("id")
      .limit(paginate)
      .offset(offset)
      .execute()

    return listSubDistrict
  }

  async getTotalCountSubDistrict(
    c: Context<DB>,
    param: GetSubDistrictsQueries
  ) {
    const { keyword, regency_id } = param
    let query = c.var.trx.selectFrom("locations").where("level", "=", 2)

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    const totalSubDistrict = await query
      .where("parent_id", "in", regency_id)
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalSubDistrict?.total) || 0
  }

  async findById(c: Context<DB>, id: string[]) {
    return await c.var.trx
      .selectFrom("locations")
      .selectAll()
      .where("id", "in", id)
      .where("level", "=", 2)
      .execute()
  }
}
