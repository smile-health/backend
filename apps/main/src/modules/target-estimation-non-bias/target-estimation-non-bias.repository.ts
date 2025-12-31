import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import { Insertable } from "kysely"
import { BaseRepository } from "../base.repository.js"

export class TargetEstimationNonBiasRepository extends BaseRepository<"ws_village_estimation_details"> {
  constructor() {
    super("ws_village_estimation_details")
  }

  async saveVillageDetail(
    c: Context,
    data: Insertable<DB["ws_village_estimation_details"]>
  ) {
    return c.var.trx
      .insertInto("ws_village_estimation_details")
      .values({
        ...data,
        created_by: c.var.userId,
        updated_by: c.var.userId,
      })
      .executeTakeFirstOrThrow()
  }

  async findByVillage(c: Context, village_id: number) {
    return c.var.trx
      .selectFrom("ws_village_estimation_details")
      .selectAll()
      .where("village_id", "=", village_id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findByMicroplanningAndVillage(
    c: Context,
    microplanning_id: number,
    village_id: number
  ) {
    return c.var.trx
      .selectFrom("ws_village_estimation_details as ved")
      .innerJoin("ws_microplanning as mp", "mp.id", "ved.microplanning_id")
      .selectAll("ved")
      .select(["mp.entity_id", "mp.id as microplanning_id"])
      .where("ved.microplanning_id", "=", microplanning_id)
      .where("ved.village_id", "=", village_id)
      .where("mp.deleted_at", "is", null)
      .where("ved.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async updateVillageDetail(
    c: Context,
    id: number,
    data: Partial<Insertable<DB["ws_village_estimation_details"]>>
  ) {
    return c.var.trx
      .updateTable("ws_village_estimation_details")
      .set({ ...data, updated_by: c.var.userId } as any)
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async getImmunizationServiceDashboard(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("locations as loc")
      .leftJoin("ws_village_estimation_details as ved", (join) =>
        join
          .onRef("ved.village_id", "=", "loc.id")
          .on("ved.microplanning_id", "=", microplanningId)
          .on("ved.deleted_at", "is", null)
      )
      .select([
        "loc.id as village_id",
        "loc.name as village_name",
        "ved.outreach_service_percentage",
        "ved.facility_service_percentage",
        "ved.required_monthly_outreach_service",
        "ved.required_monthly_facility_service",
        "ved.available_outreach_service",
        "ved.available_facillity_service",
        "ved.additional_outreach_service",
        "ved.additional_facility_service",
        "ved.additional_outreach_vaccinator_service",
        "ved.additional_facility_vaccinator_service",
      ])
      .where("loc.parent_id", "=", subDistrictId)
      .execute()
  }

  async getWorkerDataBySubDistrict(c: Context, subDistrictId: number) {
    return c.var.trx
      .selectFrom("locations as loc")
      .leftJoin("ws_village_estimation_details as ved", (join) =>
        join
          .onRef("ved.village_id", "=", "loc.id")
          .on("ved.deleted_at", "is", null)
      )
      .select([
        "loc.id as village_id",
        "loc.name as village_name",
        "ved.health_worker_ideal_needs",
        "ved.available_worker",
        "ved.gap_health_worker",
      ])
      .where("loc.parent_id", "=", subDistrictId)
      .execute()
  }

  async getVillagesBySubDistrict(
    c: Context,
    subDistrictId: number,
    microplanningId: number,
    keyword?: string
  ) {
    let query = c.var.trx
      .selectFrom("locations as loc")
      .leftJoin("ws_village_estimation_details as ved", (join) =>
        join
          .onRef("ved.village_id", "=", "loc.id")
          .on("ved.microplanning_id", "=", microplanningId)
          .on("ved.deleted_at", "is", null)
      )
      .select([
        "loc.id as village_id",
        "loc.name as village_name",
        "ved.id as village_detail_id",
        "ved.microplanning_id",
      ])
      .where("loc.parent_id", "=", subDistrictId)
      .where("loc.level", "=", 3)

    if (keyword) {
      query = query.where("loc.name", "like", `%${keyword}%`)
    }

    return query.orderBy("loc.id", "asc").execute()
  }

  async getTargetCountsByEntityId(
    c: Context,
    entityId: number,
    targetIds: number[]
  ) {
    return c.var.trx
      .selectFrom("ws_targets as t")
      .select((q) => ["t.target_group_id", q.fn.count("t.id").as("count")])
      .where("t.deleted_at", "is", null)
      .where("t.target_group_id", "is not", null)
      .where("t.entity_id", "=", entityId)
      .where("t.target_group_id", "in", targetIds)
      .groupBy("t.target_group_id")
      .execute()
  }

  async getTargetCountsByVillageId(
    c: Context,
    villageId: number,
    targetIds: number[],
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_targets as t")
      .select((q) => ["t.target_group_id", q.fn.count("t.id").as("count")])
      .where("t.deleted_at", "is", null)
      .where("t.target_group_id", "is not", null)
      .where("t.residence_village_id", "=", villageId)
      .where("t.entity_id", "is", null)
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.target_group_id", "in", targetIds)
      .groupBy("t.target_group_id")
      .execute()
  }

  async getBatchTargetCountsByVillageIds(
    c: Context,
    villageIds: number[],
    targetIds: number[]
  ) {
    const results = await c.var.trx
      .selectFrom("ws_targets as t")
      .select((q) => [
        "t.residence_village_id",
        "t.target_group_id",
        q.fn.count("t.id").as("count"),
      ])
      .where("t.deleted_at", "is", null)
      .where("t.target_group_id", "is not", null)
      .where("t.residence_village_id", "in", villageIds)
      .where("t.entity_id", "is", null)
      .where("t.target_group_id", "in", targetIds)
      .groupBy(["t.residence_village_id", "t.target_group_id"])
      .execute()

    const countsByVillage = new Map<number, Map<number, number>>()

    results.forEach((row) => {
      if (!countsByVillage.has(row.residence_village_id!)) {
        countsByVillage.set(row.residence_village_id!, new Map())
      }
      countsByVillage
        .get(row.residence_village_id!)!
        .set(row.target_group_id!, Number(row.count))
    })

    return villageIds.map((villageId) => ({
      village_id: villageId,
      counts: targetIds.map((targetGroupId) => ({
        target_group_id: targetGroupId,
        count: countsByVillage.get(villageId)?.get(targetGroupId) || 0,
      })),
    }))
  }

  async getLocationName(c: Context, locationId: number) {
    return c.var.trx
      .selectFrom("locations")
      .select("name")
      .where("id", "=", locationId)
      .executeTakeFirst()
  }

  async getVillageEstimationDetails(c: Context, villageId: number) {
    return c.var.trx
      .selectFrom("ws_village_estimation_details as ved")
      .innerJoin("ws_microplanning as mp", "mp.id", "ved.microplanning_id")
      .select([
        "ved.id",
        "ved.microplanning_id",
        "ved.village_id",
        "ved.outreach_service_percentage",
        "ved.facility_service_percentage",
        "ved.required_monthly_outreach_service",
        "ved.required_monthly_facility_service",
        "ved.available_outreach_service",
        "ved.available_facillity_service",
        "ved.additional_outreach_service",
        "ved.additional_outreach_vaccinator_service",
        "ved.additional_facility_service",
        "ved.additional_facility_vaccinator_service",
        "ved.health_worker_ideal_needs",
        "ved.available_worker",
        "ved.gap_health_worker",
      ])
      .where("ved.village_id", "=", villageId)
      .where("ved.deleted_at", "is", null)
      .where("mp.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getVillageEstimationDetailsByMicroplanning(
    c: Context,
    villageId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_village_estimation_details as ved")
      .innerJoin("ws_microplanning as mp", "mp.id", "ved.microplanning_id")
      .select([
        "ved.id",
        "ved.microplanning_id",
        "ved.village_id",
        "ved.outreach_service_percentage",
        "ved.facility_service_percentage",
        "ved.required_monthly_outreach_service",
        "ved.required_monthly_facility_service",
        "ved.available_outreach_service",
        "ved.available_facillity_service",
        "ved.additional_outreach_service",
        "ved.additional_outreach_vaccinator_service",
        "ved.additional_facility_service",
        "ved.additional_facility_vaccinator_service",
        "ved.health_worker_ideal_needs",
        "ved.available_worker",
        "ved.gap_health_worker",
      ])
      .where("ved.village_id", "=", villageId)
      .where("ved.microplanning_id", "=", microplanningId)
      .where("ved.deleted_at", "is", null)
      .where("mp.deleted_at", "is", null)
      .executeTakeFirst()
  }
}
