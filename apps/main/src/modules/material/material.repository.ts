/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  KFA_LEVEL_ID,
  MATERIAL_CONDITION_TYPE,
} from "@/common/constants/material.js"
import {
  MAP_MATERIAL_CONDITION_TYPE,
  MAP_TRANSACTION_TYPE_LABEL,
} from "@/common/constants/transaction.js"
import { ValidationError } from "@smile/lib/error.js"
import { associate, group, pick } from "@smile/lib/utils.js"
import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
import {
  GetMaterialsQueries,
  MaterialConditionDTO,
  MaterialHierarchyDTO,
} from "./material.schema.js"

export class MaterialRepository extends BaseRepository<"ws_materials"> {
  constructor(filterProgram = true) {
    super("ws_materials", filterProgram)
  }

  async findMaterialTypes(c: Context, materialTypeIds: number[]) {
    return await c.var.trx
      .selectFrom("material_types")
      .select(["id", "name"])
      .where("id", "in", materialTypeIds)
      .execute()
  }

  async findMaterialType(c: Context, materialTypeId: number) {
    const row = await c.var.trx
      .selectFrom("material_types")
      .select(["id", "name"])
      .where("id", "=", materialTypeId)
      .executeTakeFirst()

    return row
      ? {
          id: row.id,
          name: c.var.t(`material_type.label.${row.name}`),
        }
      : null
  }

  async findCompanions(c: Context, materialId: number) {
    return await c.var.trx
      .selectFrom("ws_materials as m")
      .innerJoin("ws_material_companions as mc", "mc.companion_id", "m.id")
      .select(["m.id", "m.name"])
      .where("mc.material_id", "=", materialId)
      .execute()
  }

  async findWithDetails(c: Context, materialIds: number[]) {
    if (!materialIds || materialIds.length === 0) return []

    const [materials, companions, activities] = await Promise.all([
      this.find(c, { id: materialIds }),
      c.var.trx
        .selectFrom("ws_materials as m")
        .innerJoin("ws_material_companions as mc", "mc.companion_id", "m.id")
        .select(["mc.material_id", "m.id", "m.name"])
        .where("mc.material_id", "in", materialIds)
        .execute(),
      c.var.trx
        .selectFrom("ws_material_activities as ma")
        .innerJoin("ws_activities as a", "a.id", "ma.activity_id")
        .select(["ma.material_id", "ma.activity_id", "a.name as activity_name"])
        .where("ma.material_id", "in", materialIds)
        .execute(),
    ])
    const mapCompanions = group(companions, "material_id")
    const mapActivities = group(activities, "material_id")

    return materials.map((material) => ({
      ...pick(material, [
        "id",
        "name",
        "material_level_id",
        "is_temperature_sensitive",
        "is_open_vial",
        "is_managed_in_batch",
        "unit_of_consumption",
        "consumption_unit_per_distribution_unit",
        "status",
        "is_stock_opname_mandatory",
      ]),
      companions: (mapCompanions[material.id] ?? []).map((comp) => ({
        id: comp.id,
        name: comp.name,
      })),
      activities: (mapActivities[material.id] ?? []).map((act) => ({
        id: act.activity_id,
        name: act.activity_name,
      })),
    }))
  }

  async findWithProtocols(
    c: Context,
    materialIds: number[],
    activityId?: number
  ) {
    if (!activityId || !materialIds || materialIds.length === 0) return {}

    const materialActivities = await c.var.trx
      .selectFrom("ws_material_activities as ma")
      .leftJoin("protocols as wp", "wp.id", "ma.protocol_id")
      .select([
        "ma.protocol_id as protocol_id",
        "wp.name as protocol_name",
        "ma.material_id",
        "ma.activity_id",
        "ma.is_sequence",
        "ma.is_patient_needed",
      ])
      .where("ma.material_id", "in", materialIds)
      .where("ma.activity_id", "=", activityId)
      .execute()

    return associate(materialActivities, "material_id")
  }

  async findMaterialChildren(c: Context, parentId: number) {
    const parent = await this.findOne(c, { id: parentId })
    if (!parent) {
      return []
    }

    return await c.var.trx
      .selectFrom("ws_materials as m")
      .select(["id", "name"])
      .where("parent_global_id", "=", parent.global_id)
      .execute()
  }

  async findCompanionsGroupByMaterialId(c: Context, materialIds: number[]) {
    const companions = await c.var.trx
      .selectFrom("ws_materials as m")
      .innerJoin("ws_material_companions as mc", "mc.material_id", "m.id")
      .select(["m.id", "mc.companion_id"])
      .where("m.id", "in", materialIds)
      .groupBy(["m.id", "mc.companion_id"])
      .execute()

    return group(companions, "id")
  }

  async findConditions(c: Context, materialId: number) {
    const conditions = await c.var.trx
      .selectFrom("ws_material_permissions")
      .selectAll()
      .where("ws_material_permissions.material_id", "=", materialId)
      .where("deleted_at", "is", null)
      .execute()

    const initialMap: Record<string, MaterialConditionDTO> = {}
    for (const [_, value] of Object.entries(MAP_TRANSACTION_TYPE_LABEL)) {
      initialMap[value] = {
        entity_types: [],
        roles: [],
      }
    }

    return conditions.reduce((mapCondition, condition) => {
      const key = MAP_TRANSACTION_TYPE_LABEL[condition.action ?? 0]
      if (!key || !mapCondition[key]) {
        return mapCondition
      }

      if (condition.key === MATERIAL_CONDITION_TYPE.ENTITY_TYPES) {
        mapCondition[key].entity_types.push(Number(condition.value))
      }

      if (condition.key === MATERIAL_CONDITION_TYPE.ROLES) {
        mapCondition[key].roles.push(Number(condition.value))
      }

      return mapCondition
    }, initialMap)
  }

  getStreamData(c: Context, params: GetMaterialsQueries) {
    const query = this.applyParams(c, params)
    return query.select(["m.id", "m.name"]).orderBy("m.name").stream()
  }

  async findAll(c: Context, params: GetMaterialsQueries, paginate = true) {
    const query = this.applyParams(c, params)

    const offset = (params.page - 1) * params.paginate
    const [materials, count] = await Promise.all([
      query
        .$if(paginate, (qb) => qb.limit(params.paginate).offset(offset))
        .$if(!!params.status, (qb) =>
          qb.where("m.status", "=", Number(params.status))
        )
        .selectAll("m")
        .select([
          "mp.name as parent_name",
          "mp.hierarchy_code as parent_hierarchy_code",
        ])
        .orderBy("m.name")
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: materials,
      total: Number(count.total),
    }
  }

  private readonly applyParams = (c: Context, params: GetMaterialsQueries) => {
    let query = c.var.trx
      .selectFrom("ws_materials as m")
      .leftJoin("material_relations as mr", (join) =>
        join
          .onRef("mr.child_material_id", "=", "m.global_id")
          .onRef("mr.parent_material_id", "=", "m.parent_global_id")
      )
      .leftJoin("materials as mp", "mp.id", "m.parent_global_id")
      .where("m.program_id", "=", c.var.programId)
      .$if(!!params.keyword, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("m.name", "like", `%${params.keyword}%`),
            eb("m.code", "like", `%${params.keyword}%`),
            eb("m.hierarchy_code", "like", `%${params.keyword}%`),
          ])
        )
      )

      .$if(!!params.activity_id, (qb) =>
        qb.innerJoin("ws_material_activities as ma", (join) =>
          join
            .onRef("ma.material_id", "=", "m.id")
            .on("ma.activity_id", "=", params.activity_id)
        )
      )

      .$if(!!params.material_level_id, (qb) =>
        qb.where("m.material_level_id", "=", params.material_level_id)
      )

      .$if(params.material_type_ids > 0, (qb) =>
        qb.where("m.material_type_id", "=", params.material_type_ids)
      )

      .$if(params.material_subtype_ids > 0, (qb) =>
        qb.where("m.material_subtype_id", "=", params.material_subtype_ids)
      )

      .where("m.deleted_at", "is", null)
      .where("mp.deleted_at", "is", null)

    // Sorting mechanism
    const sortMapping = {
      name: "m.name",
      material_type: "mt.name",
      min_temperature: "m.min_temperature",
      max_temperature: "m.max_temperature",
      updated_by: "u.firstname",
    }

    if (params.sort_by && sortMapping[params.sort_by]) {
      if (params.sort_by === "material_type") {
        query = query.innerJoin(
          "material_types as mt",
          "mt.id",
          "m.material_type_id"
        )
      } else if (params.sort_by === "updated_by") {
        query = query.leftJoin("users as u", "u.id", "mp.updated_by")
      } else if (params.sort_by === "material_subtype") {
        query = query.innerJoin(
          "material_subtypes as ms",
          "ms.id",
          "m.material_subtype_id"
        )
      }
      query = query.orderBy(
        sortMapping[params.sort_by],
        params.sort_type ?? "asc"
      )
    }

    return query
  }

  async syncMaterialCompanions(
    c: Context,
    materialId: number,
    companionIds: number[]
  ) {
    await c.var.trx
      .deleteFrom("ws_material_companions")
      .where("material_id", "=", materialId)
      .execute()

    if (!companionIds) {
      return
    }

    try {
      for (const companion of companionIds) {
        await c.var.trx
          .insertInto("ws_material_companions")
          .values({
            material_id: materialId,
            companion_id: companion,
          })
          .execute()
      }
    } catch (error) {
      throw new ValidationError("invalid material companions")
    }
  }

  async syncMaterialConditions(
    c: Context,
    materialId: number,
    mapCondition: Record<string, MaterialConditionDTO>
  ) {
    await c.var.trx
      .deleteFrom("ws_material_permissions")
      .where("material_id", "=", materialId)
      .execute()

    for (const type in mapCondition) {
      for (const key in mapCondition[type]) {
        const records = mapCondition[type][key].map((val: number) => ({
          material_id: materialId,
          key: key,
          value: val,
          action: MAP_MATERIAL_CONDITION_TYPE[type],
        }))

        if (records.length > 0) {
          await c.var.trx
            .insertInto("ws_material_permissions")
            .values(records)
            .execute()
        }
      }
    }
  }

  async updateStatus(c: Context, materialId: number, status: number) {
    return await c.var.trx
      .updateTable("material_workspaces")
      .set({
        status: status,
        updated_by: c.var.userId,
      })
      .where("id", "=", materialId)
      .executeTakeFirst()
  }

  async updateIsAddRemove(c: Context, materialId: number, isAddRemove: number) {
    await c.var.trx
      .updateTable("material_workspaces")
      .set({
        is_addremove: isAddRemove,
        updated_by: c.var.userId,
      })
      .where("id", "=", materialId)
      .executeTakeFirst()
  }

  async getMaterialMapped(c: Context, materialIDs: number[]) {
    if (materialIDs.length === 0) return {}
    const materials = await c.var.trx
      .selectFrom("ws_materials as m")
      .selectAll("m")
      .where("m.id", "in", materialIDs)
      .execute()

    return associate(materials, "id")
  }

  async findParentRelationsRecursive(c: Context, materialId: number) {
    const relations: MaterialHierarchyDTO[] = []
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
          "mr.parent_material_id",
        ])
        .where("mr.child_material_id", "in", currentIds)
        .execute()

      if (nextLevel.length === 0) break

      relations.push(...nextLevel)
      currentIds = nextLevel.map((rel) => rel.parent_material_id)
    }

    return relations
  }

  async findChildRelationsRecursive(c: Context, materialId: number) {
    const relations: MaterialHierarchyDTO[] = []
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
        ])
        .where("mr.parent_material_id", "in", currentIds)
        .execute()

      if (nextLevel.length === 0) break

      relations.push(...nextLevel)
      currentIds = nextLevel.map((rel) => rel.child_material_id)
    }

    return relations
  }

  async findMaterialCompanionsGroup(c: Context, materialIds: number[]) {
    const companions = await c.var.trx
      .selectFrom("ws_material_companions as mc")
      .innerJoin("ws_materials as m", "mc.companion_id", "m.id")
      .select(["m.id", "mc.material_id", "m.name", "m.code"])
      .where("mc.material_id", "in", materialIds)
      .execute()

    return group(companions, "material_id")
  }

  async findMaterialProtocols(c: Context, materialIds: number[]) {
    if (!materialIds || materialIds.length === 0) return {}

    const materialActivities = await c.var.trx
      .selectFrom("ws_material_activities as ma")
      .innerJoin("ws_activities as a", "a.id", "ma.activity_id")
      .select([
        "a.protocol as key",
        "ma.material_id",
        "ma.activity_id",
        "ma.is_sequence",
        "ma.is_patient_needed",
        "ma.protocol_id",
      ])
      .where("ma.material_id", "in", materialIds)
      .where("a.deleted_at", "is", null)
      .execute()

    return group(materialActivities, "material_id")
  }

  // check if material is already placed on stock, which means that the material is already transacted
  async findInTransaction(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_stocks as ws")
      .select("id")
      .where("ws.material_id", "=", id)
      .where("ws.deleted_at", "is", null)
      .limit(1)
      .executeTakeFirst()
  }

  async findById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("ws_materials as m")
      .selectAll("m")
      .where("m.id", "=", id)
      .where("m.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findMaterialsByIds(c: Context, ids: number[]) {
    return await c.var.trx
      .selectFrom("materials as m")
      .select(["m.id", "m.code", "m.name"])
      .where("m.deleted_at", "is", null)
      .where("m.id", "in", ids)
      .execute()
  }

  async findWsMaterialsByIds(c: Context, ids: number[]) {
    return await c.var.trx
      .selectFrom("ws_materials as m")
      .selectAll("m")
      .where("m.deleted_at", "is", null)
      .where("m.id", "in", ids)
      .orderBy("m.name asc")
      .execute()
  }

  async findMaterialsFromTargets(
    c: Context,
    type: "primary" | "additional",
    category: "bias" | "non_bias",
    injectionMonth?: string
  ) {
    return await c.var.trx
      .selectFrom("ws_material_targets as wmt")
      .innerJoin("ws_materials as wm", "wmt.material_id", "wm.id")
      .select(["wmt.material_id", "wm.name"])
      .distinct()
      .where("wmt.type", "=", type)
      .where("wmt.category", "=", category)
      .$if(!!injectionMonth, (qb) =>
        qb.where("wmt.injection_month", "=", injectionMonth!)
      )
      .where("wmt.deleted_at", "is", null)
      .orderBy("wmt.id", "asc")
      .execute()
  }

  async findMaterialColdstorage(
    c: Context,
    materialIds: number[],
    is_immunization: boolean = false
  ) {
    return await c.var.trx
      .selectFrom("ws_materials as wm")
      .where("wm.is_temperature_sensitive", "=", 1)
      .where("wm.is_managed_in_batch", "=", 1)
      .where("wm.material_level_id", "=", KFA_LEVEL_ID.VARIANT)
      .where("wm.id", "in", materialIds)
      .where("wm.deleted_at", "is", null)
      .$if(is_immunization === true, (qb) =>
        qb.where("wm.material_type", "=", `2`)
      )
      .select(["wm.id"])
      .execute()
  }
}
