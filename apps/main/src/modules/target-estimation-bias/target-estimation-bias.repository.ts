import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import { Insertable, sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import { SCHOOL_ENTITY_TAG_ID } from "@/common/constants/target.js"

export class TargetEstimationBiasRepository extends BaseRepository<"ws_school_estimation_details"> {
  constructor() {
    super("ws_school_estimation_details")
  }

  async saveSchoolDetail(
    c: Context,
    data: Insertable<DB["ws_school_estimation_details"]>
  ) {
    return c.var.trx
      .insertInto("ws_school_estimation_details")
      .values({
        ...data,
        created_by: c.var.userId,
        updated_by: c.var.userId,
      })
      .executeTakeFirstOrThrow()
  }

  async findBySchool(c: Context, school_id: number) {
    return c.var.trx
      .selectFrom("ws_school_estimation_details")
      .selectAll()
      .where("school_id", "=", school_id)
      .where("deleted_at", "is", null)
      .execute()
  }

  async findByMicroplanningAndSchool(
    c: Context,
    microplanning_id: number,
    school_id: number
  ) {
    return c.var.trx
      .selectFrom("ws_school_estimation_details as sed")
      .innerJoin("ws_microplanning as mp", "mp.id", "sed.microplanning_id")
      .selectAll("sed")
      .select(["mp.entity_id", "mp.id as microplanning_id"])
      .where("sed.microplanning_id", "=", microplanning_id)
      .where("sed.school_id", "=", school_id)
      .where("mp.deleted_at", "is", null)
      .where("sed.deleted_at", "is", null)
      .execute()
  }

  async updateSchoolDetail(
    c: Context,
    id: number,
    data: Partial<Insertable<DB["ws_school_estimation_details"]>>
  ) {
    return c.var.trx
      .updateTable("ws_school_estimation_details")
      .set({ ...data, updated_by: c.var.userId })
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async getSchoolsBySubDistrict(
    c: Context,
    subDistrictId: number,
    microplanningId: number,
    keyword?: string
  ) {
    let query = c.var.trx
      .selectFrom("entities as e")
      .leftJoin("ws_school_estimation_details as sed", (join) =>
        join
          .onRef("sed.school_id", "=", "e.id")
          .on("sed.microplanning_id", "=", microplanningId)
          .on("sed.deleted_at", "is", null)
      )
      .select([
        "e.id as school_id",
        "e.name as school_name",
        "sed.microplanning_id",
      ])
      .where("e.sub_district_id", "=", String(subDistrictId))
      .where("e.entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
      .where((eb) =>
        eb.or([eb("e.name", "like", "MI%"), eb("e.name", "like", "SD%")])
      )

    if (keyword) {
      query = query.where("e.name", "like", `%${keyword}%`)
    }

    return query.groupBy("e.id").orderBy("e.id", "asc").execute()
  }

  async getImmunizationServiceDashboard(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("entities as e")
      .leftJoin("ws_school_estimation_details as sed", (join) =>
        join
          .onRef("sed.school_id", "=", "e.id")
          .on("sed.microplanning_id", "=", microplanningId)
          .on("sed.deleted_at", "is", null)
      )
      .select((eb) => [
        "e.id as entity_id",
        "e.name as entity_name",
        eb.fn
          .coalesce(
            eb.fn.sum(
              sql<number>`CASE WHEN sed.schedule_month = 'August' THEN sed.required_service ELSE 0 END`
            ),
            sql.lit(0)
          )
          .as("august_service_point"),
        eb.fn
          .coalesce(
            eb.fn.sum(
              sql<number>`CASE WHEN sed.schedule_month = 'August' THEN sed.required_service_days ELSE 0 END`
            ),
            sql.lit(0)
          )
          .as("august_service_days"),
        eb.fn
          .coalesce(
            eb.fn.sum(
              sql<number>`CASE WHEN sed.schedule_month = 'August' THEN sed.available_vaccinator ELSE 0 END`
            ),
            sql.lit(0)
          )
          .as("august_vaccinator"),
        eb.fn
          .coalesce(
            eb.fn.sum(
              sql<number>`CASE WHEN sed.schedule_month = 'November' THEN sed.required_service ELSE 0 END`
            ),
            sql.lit(0)
          )
          .as("november_service_point"),
        eb.fn
          .coalesce(
            eb.fn.sum(
              sql<number>`CASE WHEN sed.schedule_month = 'November' THEN sed.required_service_days ELSE 0 END`
            ),
            sql.lit(0)
          )
          .as("november_service_days"),
        eb.fn
          .coalesce(
            eb.fn.sum(
              sql<number>`CASE WHEN sed.schedule_month = 'November' THEN sed.available_vaccinator ELSE 0 END`
            ),
            sql.lit(0)
          )
          .as("november_vaccinator"),
      ])
      .where("e.sub_district_id", "=", String(subDistrictId))
      .where("e.entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
      .where((eb) =>
        eb.or([eb("e.name", "like", "MI%"), eb("e.name", "like", "SD%")])
      )
      .groupBy("e.id")
      .execute()
  }

  async getTargetCountsByEntityId(
    c: Context,
    entityId: number,
    targetIds: number[],
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_targets as t")
      .select((q) => ["t.target_group_id", q.fn.count("t.id").as("count")])
      .where("t.deleted_at", "is", null)
      .where("t.target_group_id", "is not", null)
      .where("t.entity_id", "=", entityId)
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.target_group_id", "in", targetIds)
      .groupBy("t.target_group_id")
      .execute()
  }

  async getBatchTargetCountsByEntityIds(
    c: Context,
    entityIds: number[],
    targetIds: number[],
    microplanningId: number
  ) {
    const results = await c.var.trx
      .selectFrom("ws_targets as t")
      .leftJoin("ws_microplanning as m", (join) =>
        join.onRef("m.id", "=", "t.microplanning_id")
      )
      .select((q) => [
        "t.entity_id",
        "t.target_group_id",
        q.fn.count("t.id").as("count"),
      ])
      .where("t.deleted_at", "is", null)
      .where("t.target_group_id", "is not", null)
      .where("t.entity_id", "in", entityIds)
      .where("m.id", "=", microplanningId)
      .where("t.target_group_id", "in", targetIds)
      .groupBy(["t.entity_id", "t.target_group_id"])
      .execute()

    const countsByEntity = new Map<number, Map<number, number>>()

    results.forEach((row) => {
      if (!countsByEntity.has(row.entity_id!)) {
        countsByEntity.set(row.entity_id!, new Map())
      }
      countsByEntity
        .get(row.entity_id!)!
        .set(row.target_group_id!, Number(row.count))
    })

    return entityIds.map((entityId) => ({
      entity_id: entityId,
      counts: targetIds.map((targetGroupId) => ({
        target_group_id: targetGroupId,
        count: countsByEntity.get(entityId)?.get(targetGroupId) || 0,
      })),
    }))
  }

  async getSchoolName(c: Context, entityId: number) {
    return c.var.trx
      .selectFrom("entities")
      .select("name")
      .where("id", "=", entityId)
      .executeTakeFirst()
  }

  async getSchoolEstimationDetails(c: Context, schoolId: number) {
    return c.var.trx
      .selectFrom("ws_school_estimation_details as sed")
      .innerJoin("ws_microplanning as mp", "mp.id", "sed.microplanning_id")
      .select([
        "sed.id",
        "sed.microplanning_id",
        "sed.school_id",
        "sed.schedule_month",
        "sed.required_service",
        "sed.required_service_days",
        "sed.available_vaccinator",
      ])
      .where("sed.school_id", "=", schoolId)
      .where("sed.deleted_at", "is", null)
      .where("mp.deleted_at", "is", null)
      .execute()
  }

  async getSchoolEstimationDetailsByMicroplanning(
    c: Context,
    schoolId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_school_estimation_details as sed")
      .innerJoin("ws_microplanning as mp", "mp.id", "sed.microplanning_id")
      .select([
        "sed.id",
        "sed.microplanning_id",
        "sed.school_id",
        "sed.schedule_month",
        "sed.required_service",
        "sed.required_service_days",
        "sed.available_vaccinator",
      ])
      .where("sed.school_id", "=", schoolId)
      .where("sed.microplanning_id", "=", microplanningId)
      .where("sed.deleted_at", "is", null)
      .where("mp.deleted_at", "is", null)
      .execute()
  }

  async getOutOfSchoolTargetCounts(
    c: Context,
    subDistrictId: number,
    targetIds: number[],
    microplanningId?: number
  ) {
    let query = c.var.trx
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
      .where("target_group_id", "in", targetIds)

    if (microplanningId) {
      query = query.where("microplanning_id", "=", microplanningId)
    }

    return query.groupBy(["target_group_id", "gender"]).execute()
  }
}
