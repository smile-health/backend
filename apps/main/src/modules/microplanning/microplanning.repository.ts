import { Context } from "hono"
import { SCHOOL_ENTITY_TAG_ID } from "@/common/constants/target.js"

export class MicroplanningRepository {
  async getVillagesBySubDistrict(c: Context, subDistrictId: number) {
    return c.var.trx
      .selectFrom("locations as l")
      .select("l.id as village_id")
      .where("l.parent_id", "=", subDistrictId)
      .where("l.level", "=", 3)
      .execute()
  }

  async getSchoolsBySubDistrict(c: Context, subDistrictId: number) {
    return c.var.trx
      .selectFrom("entities as e")
      .select("e.id as school_id")
      .where("e.sub_district_id", "=", String(subDistrictId))
      .where("e.entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
      .where((eb) =>
        eb.or([eb("e.name", "like", "MI%"), eb("e.name", "like", "SD%")])
      )
      .execute()
  }

  async getVillagesWithTargets(c: Context, subDistrictId: number) {
    return c.var.trx
      .selectFrom("locations as l")
      .leftJoin("ws_targets as t", (join) =>
        join
          .onRef("t.residence_village_id", "=", "l.id")
          .on("t.entity_id", "is", null)
          .on("t.deleted_at", "is", null)
      )
      .select((eb) => [
        "l.id as village_id",
        eb.fn.count("t.id").as("target_count"),
      ])
      .where("l.parent_id", "=", subDistrictId)
      .where("l.level", "=", 3)
      .groupBy("l.id")
      .execute()
  }

  async getSchoolsWithTargets(c: Context, subDistrictId: number) {
    return c.var.trx
      .selectFrom("entities as e")
      .leftJoin("ws_targets as t", (join) =>
        join.onRef("t.entity_id", "=", "e.id").on("t.deleted_at", "is", null)
      )
      .select((eb) => [
        "e.id as school_id",
        eb.fn.count("t.id").as("target_count"),
      ])
      .where("e.sub_district_id", "=", String(subDistrictId))
      .where("e.entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
      .where((eb) =>
        eb.or([eb("e.name", "like", "MI%"), eb("e.name", "like", "SD%")])
      )
      .groupBy("e.id")
      .execute()
  }

  async getVillageEstimationStatus(
    c: Context,
    microplanningId: number,
    villageIds: number[]
  ) {
    return c.var.trx
      .selectFrom("ws_village_estimation_details as ved")
      .select("ved.village_id")
      .where("ved.microplanning_id", "=", microplanningId)
      .where("ved.village_id", "in", villageIds)
      .where("ved.deleted_at", "is", null)
      .execute()
  }

  async getSchoolEstimationStatus(
    c: Context,
    microplanningId: number,
    schoolIds: number[]
  ) {
    return c.var.trx
      .selectFrom("ws_school_estimation_details as sed")
      .select("sed.school_id")
      .where("sed.microplanning_id", "=", microplanningId)
      .where("sed.school_id", "in", schoolIds)
      .where("sed.deleted_at", "is", null)
      .groupBy("sed.school_id")
      .execute()
  }

  async getVillageMaterialNeedsStatus(
    c: Context,
    microplanningId: number,
    villageIds: number[]
  ) {
    return c.var.trx
      .selectFrom("ws_material_needs as wmn")
      .select("wmn.reference_id as village_id")
      .where("wmn.microplanning_id", "=", microplanningId)
      .where("wmn.reference_type", "=", "village")
      .where("wmn.reference_id", "in", villageIds)
      .where("wmn.deleted_at", "is", null)
      .groupBy("wmn.reference_id")
      .execute()
  }

  async getSchoolMaterialNeedsStatus(
    c: Context,
    microplanningId: number,
    schoolIds: number[]
  ) {
    return c.var.trx
      .selectFrom("ws_material_needs as wmn")
      .select("wmn.reference_id as school_id")
      .where("wmn.microplanning_id", "=", microplanningId)
      .where("wmn.reference_type", "=", "school")
      .where("wmn.reference_id", "in", schoolIds)
      .where("wmn.deleted_at", "is", null)
      .groupBy("wmn.reference_id")
      .execute()
  }

  async getMicroplanningByEntityAndYear(
    c: Context,
    entityId: number,
    year: number,
    status: number
  ) {
    return c.var.trx
      .selectFrom("ws_microplanning")
      .select(["id", "entity_id", "year", "status"])
      .where("entity_id", "=", entityId)
      .where("year", "=", year)
      .where("status", "=", status)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getMicroplanningByEntityAndYearAnyStatus(
    c: Context,
    entityId: number,
    year: number
  ) {
    return c.var.trx
      .selectFrom("ws_microplanning")
      .select(["id", "entity_id", "year", "status"])
      .where("entity_id", "=", entityId)
      .where("year", "=", year)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async updateMicroplanningStatus(
    c: Context,
    microplanningId: number,
    status: number
  ) {
    return c.var.trx
      .updateTable("ws_microplanning")
      .set({ status, updated_at: new Date() })
      .where("id", "=", microplanningId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async updateTargetStatus(
    c: Context,
    microplanningId: number,
    status: number
  ) {
    return c.var.trx
      .updateTable("ws_targets")
      .set({ status, updated_at: new Date() })
      .where("microplanning_id", "=", microplanningId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async updateVillageEstimationStatus(
    c: Context,
    microplanningId: number,
    status: number
  ) {
    return c.var.trx
      .updateTable("ws_village_estimation_details")
      .set({ status, updated_at: new Date() })
      .where("microplanning_id", "=", microplanningId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async updateSchoolEstimationStatus(
    c: Context,
    microplanningId: number,
    status: number
  ) {
    return c.var.trx
      .updateTable("ws_school_estimation_details")
      .set({ status, updated_at: new Date() })
      .where("microplanning_id", "=", microplanningId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async updateMaterialNeedsStatus(
    c: Context,
    microplanningId: number,
    status: number
  ) {
    return c.var.trx
      .updateTable("ws_material_needs")
      .set({ status, updated_at: new Date() })
      .where("microplanning_id", "=", microplanningId)
      .where("deleted_at", "is", null)
      .execute()
  }
}
