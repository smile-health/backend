import { Context } from "hono"
import {
  GetMaterialTypesQueryParams,
  MaterialTypeResponse,
} from "./material-type.schema.js"

export class MaterialTypeRepository {
  async findAll(c: Context, queryParam: GetMaterialTypesQueryParams) {
    let query = c.var.trx
      .selectFrom("material_types")
      .where("deleted_at", "is", null)

    if (queryParam.keyword) {
      query = query.where("name", "like", `%${queryParam.keyword}%`)
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
      .selectFrom("material_types")
      .where("deleted_at", "is", null)
      .selectAll()
      .execute()

    return {
      data: list,
      total: list.length,
    }
  }

  async findById(c: Context, id: number): Promise<MaterialTypeResponse> {
    const result = (await c.var.trx
      .selectFrom("material_types")
      .where("id", "=", id)
      .selectAll()
      .executeTakeFirst()) as MaterialTypeResponse

    return result
  }

  getStreamData(c: Context) {
    return c.var.trx
      .selectFrom("material_types as mt")
      .leftJoin("material_subtypes as ms", "ms.material_type_id", "mt.id")
      .where("mt.deleted_at", "is", null)
      .select(["mt.id", "mt.name", "ms.name as subtype_name"])
      .stream()
  }
}
