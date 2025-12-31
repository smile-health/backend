import { Context } from "hono"
import {
  GetMaterialUnitsQueryParams,
  MaterialUnitResponse,
} from "./material-unit.schema.js"

export class MaterialUnitRepository {
  async findAll(c: Context, queryParam: GetMaterialUnitsQueryParams) {
    let query = c.var.trx
      .selectFrom("material_units")
      .where("deleted_at", "is", null)

    if (queryParam.type) {
      query = query.where("type", "=", queryParam.type)
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
      .selectFrom("material_units")
      .where("deleted_at", "is", null)
      .selectAll()
      .execute()

    return {
      data: list,
      total: list.length,
    }
  }

  async findById(c: Context, id: number): Promise<MaterialUnitResponse> {
    const result = (await c.var.trx
      .selectFrom("material_units")
      .where("id", "=", id)
      .selectAll()
      .executeTakeFirst()) as MaterialUnitResponse

    return result
  }

  getStreamData(c: Context, type: string) {
    return c.var.trx
      .selectFrom("material_units")
      .where("deleted_at", "is", null)
      .where("type", "=", type)
      .select(["id", "name"])
      .stream()
  }
}
