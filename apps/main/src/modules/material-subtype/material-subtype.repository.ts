import { Context } from "hono"
import { GetListMaterialSubtypeQueries } from "./material-subtype.schema.js"

export class MaterialSubtypeRepository {
  async getListMaterialSubtypes(
    c: Context,
    params: GetListMaterialSubtypeQueries
  ) {
    const { page, paginate, subtype_id } = params
    const offset = (page - 1) * paginate

    let baseQuery = c.var.trx
      .selectFrom("material_subtypes as ms")
      .where("ms.deleted_at", "is", null)

    if (subtype_id) {
      baseQuery = baseQuery
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("material_subtype_relations as msr")
              .select("msr.id")
              .whereRef("msr.to_material_subtype_id", "=", "ms.id")
              .where("msr.from_material_subtype_id", "=", subtype_id)
              .where("msr.deleted_at", "is", null)
          )
        )
        .where("ms.id", "!=", subtype_id)
    }

    const [rows, total] = await Promise.all([
      baseQuery
        .select(["ms.id as subtype_id", "ms.name as subtype_name"])
        .limit(paginate)
        .offset(offset)
        .execute(),

      baseQuery
        .select((eb) => eb.fn.countAll<number>().as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: rows,
      total: Number(total?.total ?? 0),
    }
  }

  async findById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("material_subtypes as ms")
      .selectAll("ms")
      .where("ms.id", "=", id)
      .where("ms.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findRelation(c: Context, fromSubtypeId: number, toSubtypeId: number) {
    return await c.var.trx
      .selectFrom("material_subtype_relations as msr")
      .selectAll("msr")
      .where("msr.from_material_subtype_id", "=", fromSubtypeId)
      .where("msr.to_material_subtype_id", "=", toSubtypeId)
      .where("msr.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getStreamData(c: Context) {
    return c.var.trx
      .selectFrom("material_subtypes as ms")
      .where("ms.deleted_at", "is", null)
      .select(["ms.id", "ms.name as name"])
      .orderBy("ms.id", "asc")
      .stream()
  }
}
