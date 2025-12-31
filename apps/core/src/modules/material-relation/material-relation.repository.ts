import { Context } from "hono"
import {
  CreateMaterialRelationRequest,
  GetMaterialRelationsQueryParams,
  MaterialRelationDetailDTO,
} from "./material-relation.schema.js"

export class MaterialRelationRepository {
  async findAll(c: Context, queryParam: GetMaterialRelationsQueryParams) {
    const query = c.var.trx
      .selectFrom("material_relations")
      .where("deleted_at", "is", null)

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
      .selectFrom("material_relations")
      .where("deleted_at", "is", null)
      .selectAll()
      .execute()

    return {
      data: list,
      total: list.length,
    }
  }

  async syncMaterialRelations(
    c: Context,
    materialId: number,
    data: CreateMaterialRelationRequest[]
  ) {
    if (data.length > 0) {
      await c.var.trx
        .deleteFrom("material_relations")
        .where("child_material_id", "=", materialId)
        .execute()

      await c.var.trx.insertInto("material_relations").values(data).execute()
    }
  }

  async findParentRelation(c: Context, materialIds: number[]) {
    const result = await c.var.trx
      .selectFrom("material_relations as mr")
      .innerJoin("materials as m", "m.id", "mr.parent_material_id")
      .select([
        "m.id",
        "m.name",
        "m.material_level_id",
        "m.code",
        "m.hierarchy_code",
        "mr.child_material_id",
        "mr.parent_material_id",
      ])
      .where("mr.child_material_id", "in", materialIds)
      .execute()

    return result
  }

  async findChildRelation(c: Context, materialIds: number[]) {
    const result = await c.var.trx
      .selectFrom("material_relations as mr")
      .innerJoin("materials as m", "m.id", "mr.child_material_id")
      .select([
        "m.id",
        "m.name",
        "m.material_level_id",
        "m.code",
        "m.hierarchy_code",
        "mr.child_material_id",
        "mr.parent_material_id",
      ])
      .where("mr.parent_material_id", "in", materialIds)
      .execute()

    return result
  }

  async findParentRelationsRecursive(c: Context, materialId: number) {
    const relations: MaterialRelationDetailDTO[] = []
    let currentIds = [materialId]

    while (currentIds.length > 0) {
      const nextLevel = await c.var.trx
        .selectFrom("material_relations as mr")
        .innerJoin("materials as m", "m.id", "mr.parent_material_id")
        .select([
          "m.id",
          "m.name",
          "m.code",
          "m.hierarchy_code",
          "m.material_level_id",
          "mr.child_material_id",
          "mr.parent_material_id",
        ])
        .where("mr.child_material_id", "in", currentIds)
        .where('mr.deleted_at', 'is', null)
        .execute()

      if (nextLevel.length === 0) break

      relations.push(...nextLevel)
      currentIds = nextLevel.map((rel) => rel.parent_material_id)
    }

    return relations
  }

  async findChildRelationsRecursive(c: Context, materialId: number) {
    const relations: MaterialRelationDetailDTO[] = []
    let currentIds = [materialId]

    while (currentIds.length > 0) {
      const nextLevel = await c.var.trx
        .selectFrom("material_relations as mr")
        .innerJoin("materials as m", "m.id", "mr.child_material_id")
        .select([
          "m.id",
          "m.name",
          "m.code",
          "m.hierarchy_code",
          "m.material_level_id",
          "mr.child_material_id",
          "mr.parent_material_id",
        ])
        .where("mr.parent_material_id", "in", currentIds)
        .where('mr.deleted_at', 'is', null)
        .execute()

      if (nextLevel.length === 0) break

      relations.push(...nextLevel)
      currentIds = nextLevel.map((rel) => rel.child_material_id)
    }

    return relations
  }
}
