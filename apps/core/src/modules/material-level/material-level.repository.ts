import { Context } from "hono";
import { GetMaterialLevelsQueryParams, MaterialLevelResponse } from "./material-level.schema.js";

export class MaterialLevelRepository {
  async findAll(c: Context, queryParam: GetMaterialLevelsQueryParams) {
    let query = c.var.trx
      .selectFrom("material_levels")
      .where("deleted_at", "is", null)
    
    if (queryParam.enable_only) {
      query = query.where("enable", "=", Number(queryParam.enable_only))
    }

    const offset = (queryParam.page - 1) * queryParam.paginate
    const [list, count] = await Promise.all([
      query.limit(queryParam.paginate).offset(offset).selectAll().execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: list,
      total: Number(count.total),
    }
  }

  async findAllWithoutPaginate(c: Context) {
    const list = await c.var.trx
      .selectFrom("material_levels")
      .where("deleted_at", "is", null)
      .selectAll()
      .execute()

    return {
      data: list,
      total: list.length,
    }
  }

  async findById(c: Context, id: number): Promise<MaterialLevelResponse> {
    const result = await c.var.trx
      .selectFrom("material_levels")
      .where("id", "=", id)
      .selectAll()
      .executeTakeFirst() as MaterialLevelResponse

    return result
  }
}
