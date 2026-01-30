import { BaseRepository } from "../base.repository.js"
import { Context } from "@smile-health/lib/types/context.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { ENTITY_TAG } from "@/common/constants/entity.js"

export class OrderRelocationRepository extends BaseRepository<"ws_orders"> {
  constructor(filterProgram = false, filterActivity = true) {
    super("ws_orders", filterProgram, filterActivity)
  }

  async getWsMaterialByMaterialIds(
    c: Context<DB>,
    materialId: number[],
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_materials as wm")
      .selectAll()
      .where("wm.id", "in", materialId)
      .where("wm.program_id", "=", programId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getMaterialRelationByMaterialId(c: Context<DB>, materialId: number) {
    return await c.var.trx
      .selectFrom("material_relations as mr")
      .selectAll()
      .where("mr.parent_material_id", "=", materialId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getWsMaterialById(c: Context<DB>, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_materials")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getWsEntitiesById(c: Context<DB>, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getWsUsersByEntityId(
    c: Context<DB>,
    entityId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_users")
      .selectAll()
      .where("entity_id", "=", entityId)
      .where("program_id", "=", programId)
      .where("status", "=", 1)
      .where("role", "not in", [1, 2])
      .execute()
  }

  async getWsEntitiesByIds(c: Context<DB>, ids: number[], programId: number) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select(["id", "name", "entity_tag_id", "province_id", "regency_id"])
      .where("id", "in", ids)
      .where("program_id", "=", programId)
      .execute()
  }

  async getWsMaterialByIds(c: Context<DB>, ids: number[], programId: number) {
    return await c.var.trx
      .selectFrom("ws_materials")
      .selectAll()
      .where("id", "in", ids)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getWsEntitiesByLocationAndType(
    c: Context<DB>,
    tagVendor: number,
    programId: number,
    entityId: number,
    locationId?: number
  ) {
    return c.var.trx
      .selectFrom("ws_entities as wse")
      .innerJoin("ws_customer_vendors as wscv", (join) =>
        join
          .onRef("wscv.vendor_id", "=", "wse.id")
          .on("wscv.customer_id", "=", entityId)
          .on("wscv.program_id", "=", programId)
      )
      .selectAll("wse")
      .$if(tagVendor === ENTITY_TAG.PROVINCE_HEALTH_OFFICE, (b) =>
        b.where("wse.province_id", "=", `${locationId}`)
      )
      .$if(tagVendor === ENTITY_TAG.CITY_DISTRICT_HEALTH_OFFICE, (b) =>
        b.where("wse.regency_id", "=", `${locationId}`)
      )
      .where("wse.entity_tag_id", "=", tagVendor)
      .where("wse.program_id", "=", programId)
      .where("wse.deleted_at", "is", null)
      .where("wse.status", "=", 1)
      .execute()
  }

  async createOtherReason(c: Context<DB>, req) {
    return await c.var.trx
      .insertInto("ws_other_reasons")
      .values(req)
      .executeTakeFirst()
  }
}
