import { Context } from "hono"
import { sql } from "kysely"

export class PopulationRepository {
  async getPopulationDetailByProgramPlan(
    c: Context,
    programPlanId: number,
    provinceId: number
  ) {
    const trx = c.var.trx

    const plan = await trx
      .selectFrom("ws_program_plans as wspp")
      .innerJoin("plan_approaches as pa", (join) =>
        join
          .onRef("pa.id", "=", "wspp.approach_id")
          .on("pa.deleted_at", "is", null)
      )
      .select(["wspp.year", "pa.name as approach"])
      .where("wspp.id", "=", programPlanId)
      .where("wspp.deleted_at", "is", null)
      .executeTakeFirstOrThrow()

    const { year, approach } = plan

    const province = await trx
      .selectFrom("locations")
      .select(["name"])
      .where("id", "=", provinceId)
      .executeTakeFirst()

    const aggregate = await trx
      .selectFrom("populations as p")
      .innerJoin("target_groups as tg", "tg.id", "p.target_group_id")
      .innerJoin(
        "ws_plan_target_group as wsptg",
        "wsptg.target_group_id",
        "p.target_group_id"
      )
      .innerJoin("ws_program_plans as wspp", "wspp.id", "wsptg.program_plan_id")
      .where("p.deleted_at", "is", null)
      .where("wsptg.deleted_at", "is", null)
      .where("wspp.deleted_at", "is", null)
      .where("wsptg.program_plan_id", "=", programPlanId)
      .where("p.year", "=", year)
      .where("p.province_id", "=", provinceId)
      .select([
        sql<number>`tg.id`.as("id"),
        sql<string>`tg.title`.as("name"),
        sql<number>`SUM(p.population_number)`.as("population_number"),
      ])
      .groupBy(["tg.id", "tg.title"])
      .execute()

    const rows = await trx
      .selectFrom("populations as p")
      .innerJoin("entities as e", "e.id", "p.entity_id")
      .leftJoin("locations as prov", "prov.id", "e.province_id")
      .leftJoin("locations as reg", "reg.id", "e.regency_id")
      .innerJoin("target_groups as tg", "tg.id", "p.target_group_id")
      .innerJoin(
        "ws_plan_target_group as wsptg",
        "wsptg.target_group_id",
        "p.target_group_id"
      )
      .innerJoin("ws_program_plans as wspp", "wspp.id", "wsptg.program_plan_id")
      .where("p.deleted_at", "is", null)
      .where("wsptg.deleted_at", "is", null)
      .where("wspp.deleted_at", "is", null)
      .where("wsptg.program_plan_id", "=", programPlanId)
      .where("p.year", "=", year)
      .where("p.province_id", "=", provinceId)
      .select([
        sql<number>`e.id`.as("entity_id"),
        sql<string>`e.name`.as("entity_name"),
        sql<string>`prov.name`.as("province_name"),
        sql<string>`reg.name`.as("regency_name"),
        sql<number>`tg.id`.as("target_group_id"),
        sql<string>`tg.title`.as("target_group_title"),
        sql<number>`SUM(p.population_number)`.as("population_number"),
        sql<Date>`MAX(p.updated_at)`.as("updated_at"),
        sql<number | null>`MAX(p.updated_by)`.as("updated_by"),
      ])
      .groupBy(["e.id", "e.name", "prov.name", "reg.name", "tg.id", "tg.title"])
      .orderBy("e.id")
      .execute()

    return {
      year,
      approach,
      provinceName: province?.name ?? null,
      aggregate,
      rows,
    }
  }
}
