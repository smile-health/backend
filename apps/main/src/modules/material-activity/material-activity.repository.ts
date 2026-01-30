import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { Context as ContextHono } from "hono"
import { BaseRepository } from "../base.repository.js"

export class MaterialActivityRepository extends BaseRepository<"ws_material_activities"> {
  constructor() {
    super("ws_material_activities", false, true)
  }
  async findByIds(c: Context<DB>, id: number[], programId: number) {
    return await c.var.trx
      .selectFrom("ws_material_activities as mmha")
      .leftJoin("ws_materials as m", "m.id", "mmha.material_id")
      .leftJoin("ws_activities as ma", "ma.id", "mmha.activity_id")
      .select([
        "mmha.id",
        "mmha.material_id",
        "mmha.activity_id",
        "mmha.is_sequence",
      ])
      .where("mmha.id", "in", id)
      .where("ma.program_id", "=", programId)
      .where("m.program_id", "=", programId)
      .execute()
  }

  getMasterMaterialHasActivityStream(
    c: Context<DB>,
    activityIds: number[],
    materialTypeIds: number[],
    programId: number,
    keyword?: string,
    isKFAEnabled: boolean = false
  ) {
    return c.var.trx
      .selectFrom("ws_material_activities as mmha")
      .leftJoin("ws_materials as m", "m.id", "mmha.material_id")
      .leftJoin("ws_activities as ma", "ma.id", "mmha.activity_id")
      .leftJoin("material_types as mt", "mt.id", "m.material_level_id")
      .select(["mmha.id as id", "m.name as material", "ma.name as activity"])
      .where("ma.program_id", "=", programId)
      .where("m.program_id", "=", programId)
      .where("m.deleted_at", "is", null)
      .where("ma.deleted_at", "is", null)
      .$if(isKFAEnabled, (qb) =>
        qb.where("m.material_level_id", "!=", KFA_LEVEL_ID.VARIANT)
      )
      .$if(activityIds.length > 0, (qb) =>
        qb.where("mmha.activity_id", "in", activityIds)
      )
      .$if(materialTypeIds.length > 0, (qb) =>
        qb.where("m.material_level_id", "in", materialTypeIds)
      )
      .$if(!!keyword, (qb) => qb.where("m.name", "like", `%${keyword}%`))
      .stream()
  }

  async getMaterialActivityByMaterialCode(
    c: ContextHono,
    materialCode: string | string[],
    activityId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_material_activities as mmha")
      .leftJoin("ws_materials as m", "m.id", "mmha.material_id")
      .leftJoin("ws_activities as ma", "ma.id", "mmha.activity_id")
      .select([
        "mmha.id as id",
        "m.name as material",
        "m.code as code",
        "ma.id as activity_id",
      ])
      .where("ma.id", "=", activityId)
      .$if(typeof materialCode === "string", (qb) =>
        qb.where("m.code", "=", materialCode)
      )
      .$if(Array.isArray(materialCode), (qb) =>
        qb.where("m.code", "in", materialCode)
      )
      .execute()
  }
}
