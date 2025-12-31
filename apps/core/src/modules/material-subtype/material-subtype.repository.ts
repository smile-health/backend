import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
import { GetListSubtypeQueries } from "./material-subtype.schema.js"

export class MaterialSubtypeRepository extends BaseRepository<"material_subtypes"> {
  constructor() {
    super("material_subtypes")
  }

  async getListSubtype(c: Context, params: GetListSubtypeQueries) {
    const { page, paginate, keyword, material_type_id } = params
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom(this.tableName)
      .where("deleted_at", "is", null)

    if (keyword) {
      query = query.where("name", "like", `%${keyword}%`)
    }

    if (material_type_id) {
      query = query.where("material_type_id", "=", Number(material_type_id))
    }

    const [list, totalList] = await Promise.all([
      query.select(["id", "name"]).limit(paginate).offset(offset).execute(),
      query.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return {
      list,
      total: Number(totalList?.total) || 0,
    }
  }

  getStreamData(c: Context) {
    return c.var.trx
      .selectFrom(this.tableName)
      .where("deleted_at", "is", null)
      .select(["id", "name"])
      .stream()
  }

  async findAllWithoutPaginate(c: Context) {
    const list = await c.var.trx
      .selectFrom(this.tableName)
      .where("deleted_at", "is", null)
      .selectAll()
      .execute()

    return {
      data: list,
      total: list.length,
    }
  }

  async findById(c: Context, id: number) {
    const result = await c.var.trx
      .selectFrom(this.tableName)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .selectAll()
      .executeTakeFirst()

    return result
  }
}
