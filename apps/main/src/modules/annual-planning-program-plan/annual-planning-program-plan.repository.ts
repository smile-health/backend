import { associate } from "@smile/lib/utils.js"
import { Context } from "hono"
import { sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import { GetListProgramPlanQueries } from "./annual-planning-program-plan.schema.js"

export class AnnualPlanningProgramPlanRepository extends BaseRepository<"ws_program_plans"> {
  constructor() {
    super("ws_program_plans")
  }

  async getListProgramPlan(
    c: Context,
    params: GetListProgramPlanQueries,
    programId: number
  ) {
    const { page, paginate, year, sort_by, sort_type } = params
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom(`${this.tableName} as ws_program_plans`)
      .innerJoin("plan_approaches as pa", (join) =>
        join
          .onRef("pa.id", "=", "ws_program_plans.approach_id")
          .on("pa.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_users as wsu_created",
        "wsu_created.id",
        "ws_program_plans.created_by"
      )
      .leftJoin(
        "ws_users as wsu_updated",
        "wsu_updated.id",
        "ws_program_plans.updated_by"
      )
      .where("ws_program_plans.deleted_at", "is", null)
      .where("ws_program_plans.program_id", "=", programId)

    if (year) {
      query = query.where("ws_program_plans.year", "=", sql<number>`${year}`)
    }

    switch (sort_by) {
      case "year":
        query = query.orderBy(sql.ref("ws_program_plans.year"), sort_type)
        break
      case "is_final":
        query = query.orderBy(sql.ref("ws_program_plans.status"), sort_type)
        break
      case "updated_at":
        query = query.orderBy(sql.ref("ws_program_plans.updated_at"), sort_type)
        break
      default:
        query = query.orderBy(sql.ref("ws_program_plans.id"), "asc")
    }

    const [list, totalList] = await Promise.all([
      query
        .select([
          "ws_program_plans.id",
          "ws_program_plans.year",
          "ws_program_plans.program_id",
          "ws_program_plans.is_active",
          "ws_program_plans.status",
          "ws_program_plans.updated_at",
          "pa.id as approach_id",
          "pa.name as approach_name",
          "wsu_created.id as id_created",
          "wsu_created.username as username_created",
          "wsu_created.firstname as firstname_created",
          "wsu_created.lastname as lastname_created",
          "wsu_updated.id as id_updated",
          "wsu_updated.username as username_updated",
          "wsu_updated.firstname as firstname_updated",
          "wsu_updated.lastname as lastname_updated",
        ])
        .limit(paginate)
        .offset(offset)
        .execute(),
      query.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return {
      list,
      total: Number(totalList?.total) || 0,
    }
  }

  async getDetailProgramPlan(c: Context, id: number, programId: number) {
    return c.var.trx
      .selectFrom(`${this.tableName} as ws_program_plans`)
      .innerJoin("plan_approaches as pa", (join) =>
        join
          .onRef("pa.id", "=", "ws_program_plans.approach_id")
          .on("pa.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_plan_target_group as wsptg",
        "wsptg.program_plan_id",
        "ws_program_plans.id"
      )
      .leftJoin(
        "ws_plan_tasks as wspt",
        "wspt.program_plan_id",
        "ws_program_plans.id"
      )
      .leftJoin(
        "ws_material_ratios as wsmr",
        "wsmr.program_plan_id",
        "ws_program_plans.id"
      )
      .leftJoin(
        "ws_material_substitutions as wsms",
        "wsms.program_plan_id",
        "ws_program_plans.id"
      )
      .where("ws_program_plans.deleted_at", "is", null)
      .where("ws_program_plans.id", "=", id)
      .where("ws_program_plans.program_id", "=", programId)
      .select([
        "ws_program_plans.id",
        "ws_program_plans.year",
        "ws_program_plans.program_id",
        "ws_program_plans.status",
        "pa.id as approach_id",
        "pa.name as approach_name",
        "wsptg.id as id_target_group",
        "wspt.id as id_tasks",
        "wsmr.id as id_material_ratio",
        "wsms.id as id_material_substitution",
      ])
      .executeTakeFirst()
  }

  async getProgramPlanMapped(c: Context, programPlanIds: number[]) {
    if (!programPlanIds || programPlanIds.length === 0) return {}

    const plans = await c.var.trx
      .selectFrom("ws_program_plans")
      .selectAll()
      .where("id", "in", programPlanIds)
      .execute()

    return associate(plans, "id")
  }

  async getStreamData(c: Context) {
    return c.var.trx
      .selectFrom(`ws_program_plans`)
      .where("is_active", "=", 1)
      .where("ws_program_plans.deleted_at", "is", null)
      .where("ws_program_plans.program_id", "=", c.var.programId)
      .select(["ws_program_plans.id", "ws_program_plans.year"])
      .orderBy("ws_program_plans.year", "asc")
      .stream()
  }
}
