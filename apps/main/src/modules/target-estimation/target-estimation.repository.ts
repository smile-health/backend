import { DB } from "@/common/infrastructure/database/types/db.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { BaseRepository } from "../base.repository.js"

export class TargetEstimationRepository extends BaseRepository<"ws_school_estimation_details"> {
  constructor() {
    super("ws_school_estimation_details")
  }

  async getAllSchoolEstimationsByMicroplanningId(
    c: CustomContext<DB>,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_school_estimation_details as sed")
      .innerJoin("ws_microplanning as mp", "mp.id", "sed.microplanning_id")
      .selectAll("sed")
      .select(["mp.entity_id as microplanning_entity_id"])
      .where("sed.microplanning_id", "=", microplanningId)
      .where("sed.deleted_at", "is", null)
      .where("mp.deleted_at", "is", null)
      .execute()
  }

  async getTargetCountsBySchoolId(
    c: CustomContext<DB>,
    schoolId: number,
    targetIds: number[],
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_targets as t")
      .select((q) => ["t.target_group_id", q.fn.count("t.id").as("count")])
      .where("t.deleted_at", "is", null)
      .where("t.target_group_id", "is not", null)
      .where("t.entity_id", "=", schoolId)
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.target_group_id", "in", targetIds)
      .groupBy("t.target_group_id")
      .execute()
  }

  async getOutOfSchoolTargetCountsForCron(
    c: CustomContext<DB>,
    subDistrictId: number,
    targetIds: number[],
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_targets")
      .select((q) => [
        "target_group_id",
        "gender",
        q.fn.count("id").as("count"),
      ])
      .where("deleted_at", "is", null)
      .where("target_group_id", "is not", null)
      .where("entity_id", "is", null)
      .where("residence_subdistrict_id", "=", subDistrictId)
      .where("microplanning_id", "=", microplanningId)
      .where("target_group_id", "in", targetIds)
      .groupBy(["target_group_id", "gender"])
      .execute()
  }

  async updateSchoolEstimationById(
    c: CustomContext<DB>,
    id: number,
    data: {
      required_service: number
      required_service_days: number
    }
  ) {
    const query = c.var.trx
      .updateTable("ws_school_estimation_details")
      .set({
        required_service: data.required_service,
        required_service_days: data.required_service_days,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .where("deleted_at", "is", null)

    await query.execute()
  }

  async getEntitySubDistrictId(c: CustomContext<DB>, entityId: number) {
    return c.var.trx
      .selectFrom("entities")
      .select(["sub_district_id"])
      .where("id", "=", entityId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getAllVillageEstimationsByMicroplanningId(
    c: CustomContext<DB>,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_village_estimation_details as ved")
      .innerJoin("ws_microplanning as mp", "mp.id", "ved.microplanning_id")
      .selectAll("ved")
      .select(["mp.entity_id as microplanning_entity_id"])
      .where("ved.microplanning_id", "=", microplanningId)
      .where("ved.deleted_at", "is", null)
      .where("mp.deleted_at", "is", null)
      .execute()
  }

  async getTargetCountsByVillageId(
    c: CustomContext<DB>,
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

  async updateVillageEstimationById(
    c: CustomContext<DB>,
    id: number,
    data: {
      required_monthly_outreach_service: number
      required_monthly_facility_service: number
      additional_outreach_service: number
      additional_facility_service: number
      additional_outreach_vaccinator_service: number
      additional_facility_vaccinator_service: number
      health_worker_ideal_needs: number
      gap_health_worker: number
    }
  ) {
    const query = c.var.trx
      .updateTable("ws_village_estimation_details")
      .set({
        required_monthly_outreach_service:
          data.required_monthly_outreach_service,
        required_monthly_facility_service:
          data.required_monthly_facility_service,
        additional_outreach_service: data.additional_outreach_service,
        additional_facility_service: data.additional_facility_service,
        additional_outreach_vaccinator_service:
          data.additional_outreach_vaccinator_service,
        additional_facility_vaccinator_service:
          data.additional_facility_vaccinator_service,
        health_worker_ideal_needs: data.health_worker_ideal_needs,
        gap_health_worker: data.gap_health_worker,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .where("deleted_at", "is", null)

    await query.execute()
  }

  // ============ TARGET GROUP PROMOTION METHODS ============

  /**
   * Get targets with their consumption data where today is between ideal_date and end_ideal_date
   */
  async getTargetsWithActiveIdealDate(
    c: CustomContext<DB>,
    microplanningId: number,
    today: Date
  ) {
    return c.var.trx
      .selectFrom("ws_targets as t")
      .innerJoin(
        "ws_microplan_targets_consumptions as mtc",
        "mtc.target_id",
        "t.id"
      )
      .select([
        "t.id as target_id",
        "t.target_group_id as current_target_group_id",
        "t.gender",
        "t.microplanning_id",
        "mtc.id as consumption_id",
        "mtc.target_group_id as consumption_target_group_id",
        "mtc.ideal_date",
        "mtc.end_ideal_date",
      ])
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.deleted_at", "is", null)
      .where("mtc.deleted_at", "is", null)
      .where("mtc.ideal_date", "<=", today)
      .where("mtc.end_ideal_date", ">=", today)
      .orderBy("mtc.target_group_id", "asc")
      .execute()
  }

  /**
   * Get the first (lowest) target_group_id from consumptions for a specific target
   */
  async getFirstConsumptionTargetGroup(
    c: CustomContext<DB>,
    targetId: number,
    today: Date,
    current_target_group: number | null
  ) {
    return c.var.trx
      .selectFrom("ws_microplan_targets_consumptions")
      .select(["target_group_id", "ideal_date", "end_ideal_date", "id"])
      .where("target_id", "=", targetId)
      .where("deleted_at", "is", null)
      .where("target_group_id", "=", current_target_group! + 1)
      .where("ideal_date", "<=", today)
      .where("end_ideal_date", ">=", today)
      .orderBy("target_group_id", "asc")
      .executeTakeFirst()
  }

  /**
   * Update target_group_id in ws_targets
   */
  async updateTargetGroupId(
    c: CustomContext<DB>,
    targetId: number,
    newTargetGroupId: number
  ) {
    await c.var.trx
      .updateTable("ws_targets")
      .set({
        target_group_id: newTargetGroupId,
        updated_at: new Date(),
      })
      .where("id", "=", targetId)
      .where("deleted_at", "is", null)
      .execute()
  }

  /**
   * Get all unique targets that have active consumptions (today between ideal_date and end_ideal_date)
   */
  async getUniqueTargetsWithActiveConsumptions(
    c: CustomContext<DB>,
    microplanningId: number,
    today: Date
  ) {
    return c.var.trx
      .selectFrom("ws_targets as t")
      .innerJoin(
        "ws_microplan_targets_consumptions as mtc",
        "mtc.target_id",
        "t.id"
      )
      .select([
        "t.id as target_id",
        "t.target_group_id as current_target_group_id",
        "t.gender",
        "t.target_group_id",
      ])
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.deleted_at", "is", null)
      .where("mtc.deleted_at", "is", null)
      .where("mtc.ideal_date", "<=", today)
      .where("mtc.end_ideal_date", ">=", today)
      .groupBy("t.id")
      .execute()
  }
}
