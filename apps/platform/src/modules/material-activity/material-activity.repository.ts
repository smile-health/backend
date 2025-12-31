import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"

export class MaterialActivityRepository {
  async findByIds(c: Context<DB>, id: number[]) {
    return await c.var.trx
      .selectFrom("master_material_has_activities")
      .select(["id", "activity_id", "master_material_id", "is_sequence"])
      .where("id", "in", id)
      .execute()
  }

  getMasterMaterialHasActivityStream(
    c: Context<DB>,
    activityIds: number[],
    materialTypeIds: number[],
    keyword?: string,
    isKFAEnabled: boolean = false
  ) {
    return c.var.trx
      .selectFrom("master_material_has_activities as mmha")
      .leftJoin("master_materials as m", "m.id", "mmha.master_material_id")
      .leftJoin("master_activities as ma", "ma.id", "mmha.activity_id")
      .leftJoin("master_material_type as mt", "mt.id", "m.is_vaccine")
      .select(["mmha.id as id", "ma.name as activity", "m.name as material"])
      .$if(isKFAEnabled, (qb) =>
        qb.where("m.kfa_level_id", "!=", KFA_LEVEL_ID.VARIANT)
      )
      .$if(activityIds.length > 0, (qb) =>
        qb.where("mmha.activity_id", "in", activityIds)
      )
      .$if(materialTypeIds.length > 0, (qb) =>
        qb.where("m.is_vaccine", "in", materialTypeIds)
      )
      .$if(!!keyword, (qb) => qb.where("m.name", "like", `%${keyword}%`))
      .stream()
  }
}
