/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  GLOBAL_MATERIAL_TYPES,
  MAP_NEW_TO_OLD_MATERIAL_TYPES,
  MAP_OLD_TO_NEW_MATERIAL_TYPES,
  MATERIAL_CONDITION_TYPE,
} from "@/common/constants/material.js"
import {
  MAP_MATERIAL_CONDITION_TYPE,
  MAP_TRANSACTION_TYPE_LABEL,
} from "@/common/constants/transaction.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { BaseRepository } from "@smile/lib/base/repository.js"
import { ValidationError } from "@smile/lib/error.js"
import { associate, group } from "@smile/lib/utils.js"
import { Context } from "hono"
import { GetMaterialsQueries, MaterialConditionDTO } from "./material.schema.js"

export class MaterialRepository extends BaseRepository<DB, "master_materials"> {
  constructor() {
    super("master_materials")
  }

  findMaterialType(c: Context, materialTypeId: number) {
    const globalMaterialTypeId =
      MAP_OLD_TO_NEW_MATERIAL_TYPES[c.var.workspaceId ?? 1][materialTypeId]
    if (!globalMaterialTypeId) {
      return null
    }

    return {
      id: globalMaterialTypeId,
      name: GLOBAL_MATERIAL_TYPES[globalMaterialTypeId],
    }
  }

  async findMaterialTypes(c: Context, materialTypeId: number[]) {
    return await c.var.trx
      .selectFrom("master_material_type")
      .select(["id", "name"])
      .where("id", "in", materialTypeId)
      .execute()
  }

  async findCompanions(c: Context, materialId: number) {
    return await c.var.trx
      .selectFrom("master_materials as m")
      .innerJoin(
        "master_material_has_companions as mc",
        "mc.master_material_companion_id",
        "m.id"
      )
      .select(["m.id", "m.name"])
      .where("mc.master_material_id", "=", materialId)
      .execute()
  }

  async findCompanionsGroupByMaterialId(c: Context, materialIds: number[]) {
    const companions = await c.var.trx
      .selectFrom("master_materials as m")
      .innerJoin(
        "master_material_has_companions as mc",
        "mc.master_material_companion_id",
        "m.id"
      )
      .select(["m.id", "mc.master_material_id"])
      .where("mc.master_material_id", "in", materialIds)
      .execute()

    return group(companions, "id")
  }

  async findLevelMapping(c: Context, materialId: number) {
    return await c.var.trx
      .selectFrom("mapping_master_materials")
      .selectAll()
      .where("id_material_smile", "=", materialId)
      .executeTakeFirst()
  }

  async findConditions(c: Context, materialId: number) {
    const conditions = await c.var.trx
      .selectFrom("master_material_has_conditions")
      .selectAll()
      .where(
        "master_material_has_conditions.master_material_id",
        "=",
        materialId
      )
      .execute()

    const initialMap: Record<string, MaterialConditionDTO> = {}
    for (const [key, value] of Object.entries(MAP_TRANSACTION_TYPE_LABEL)) {
      initialMap[value] = {
        entity_types: [],
        roles: [],
      }
    }

    return conditions.reduce((mapCondition, condition) => {
      const key = MAP_TRANSACTION_TYPE_LABEL[condition.type ?? 0]
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
    return query.select(["m.id", "m.name"]).stream()
  }

  async findAll(c: Context, params: GetMaterialsQueries, paginate = true) {
    const query = this.applyParams(c, params)

    const offset = (params.page - 1) * params.paginate
    const [materials, count] = await Promise.all([
      query
        .$if(paginate, (qb) => qb.limit(params.paginate).offset(offset))
        .selectAll("m")
        .select([
          "mp.name as parent_name",
          "mp.kfa_code as parent_hierarchy_code",
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

  private applyParams = (c: Context, params: GetMaterialsQueries) => {
    const materialTypeIds = params.material_type_ids
      ? (MAP_NEW_TO_OLD_MATERIAL_TYPES[c.var.workspaceId ?? 1][
          params.material_type_ids
        ] ?? [-1])
      : []

    return c.var.trx
      .selectFrom("master_materials as m")
      .leftJoin("master_materials as mp", "mp.id", "m.parent_id")
      .$if(!!params.keyword, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("m.name", "like", `%${params.keyword}%`),
            eb("m.code", "like", `%${params.keyword}%`),
            eb("m.kfa_code", "like", `%${params.keyword}%`),
          ])
        )
      )

      .$if(!!params.activity_id, (qb) =>
        qb.innerJoin("master_material_has_activities as ma", (join) =>
          join
            .onRef("ma.master_material_id", "=", "m.id")
            .on("ma.activity_id", "=", params.activity_id)
        )
      )

      .$if(!!params.material_level_id, (qb) =>
        qb.where("m.kfa_level_id", "=", params.material_level_id)
      )

      .$if(materialTypeIds.length > 0, (qb) =>
        qb.where("m.is_vaccine", "in", materialTypeIds)
      )

      .where("m.deleted_at", "is", null)
  }

  async syncMaterialCompanions(
    c: Context,
    materialId: number,
    companionIds: number[]
  ) {
    await c.var.trx
      .deleteFrom("master_material_has_companions")
      .where("master_material_id", "=", materialId)
      .execute()

    if (!companionIds) {
      return
    }

    try {
      for (const companion of companionIds) {
        await c.var.trx
          .insertInto("master_material_has_companions")
          .values({
            master_material_id: materialId,
            master_material_companion_id: companion,
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
      .deleteFrom("master_material_has_conditions")
      .where("master_material_id", "=", materialId)
      .execute()

    for (const type in mapCondition) {
      for (const key in mapCondition[type]) {
        const records = mapCondition[type][key].map((val: number) => ({
          master_material_id: materialId,
          key: key,
          value: val,
          type: MAP_MATERIAL_CONDITION_TYPE[type],
        }))

        if (records.length > 0) {
          await c.var.trx
            .insertInto("master_material_has_conditions")
            .values(records)
            .execute()
        }
      }
    }
  }

  async getMaterialMapped(c: Context, materialIDs: number[]) {
    if (materialIDs.length === 0) return {}
    const materials = await c.var.trx
      .selectFrom("master_materials as m")
      .select([
        "id",
        "name",
        "unit_of_distribution",
        "code",
        "description",
        "pieces_per_unit",
        "pieces_per_unit",
        "unit",
        "temperature_sensitive",
        "temperature_min",
        "temperature_max",
        "managed_in_batch",
        "status",
        "is_vaccine",
        "is_stockcount",
        "is_addremove",
        "updated_at",
        "is_openvial",
        "kfa_code",
        "need_sequence",
        "parent_id",
        "kfa_level_id",
      ])
      .where("m.id", "in", materialIDs)
      .execute()

    return associate(materials, "id")
  }
}
