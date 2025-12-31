import { Context } from "hono"
import { sql } from "kysely"
import { GetPopulationQueries } from "./population.schema.js"

export class PopulationRepository {
  async getPopulations(c: Context, queries: GetPopulationQueries) {
    let query = c.var.trx
      .selectFrom("populations")
      .where("deleted_at", "is", null)

    if (queries.keyword) {
      query = query.where((eb) =>
        eb(sql`CAST(year AS CHAR)`, "like", `%${queries.keyword}%`)
      )
    }

    const sortBy = queries.sort_by || "year"
    const sortType = queries.sort_type || "desc"

    const [data, count] = await Promise.all([
      query
        .select([
          sql<number>`year`.as("year"),
          sql<number>`MAX(status)`.as("status"),
          sql<Date>`MAX(updated_at)`.as("updated_at"),
          sql<number | null>`MAX(updated_by)`.as("updated_by"),
        ])
        .groupBy("year")
        .limit(queries.paginate)
        .offset((queries.page - 1) * queries.paginate)
        .orderBy(sortBy, sortType)
        .execute(),
      query
        .select(sql<number>`COUNT(DISTINCT year)`.as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return { data, total: Number(count.total) }
  }

  async getPopulationDetail(c: Context, year: number, provinceId: number) {
    const trx = c.var.trx

    const province = await trx
      .selectFrom("locations")
      .select(["name"])
      .where("id", "=", provinceId)
      .executeTakeFirst()

    const aggregate = await trx
      .selectFrom("populations as p")
      .innerJoin("target_groups as tg", "tg.id", "p.target_group_id")
      .where("p.deleted_at", "is", null)
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
      .where("p.deleted_at", "is", null)
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
      provinceName: province?.name ?? null,
      aggregate,
      rows,
    }
  }

  async updatePopulationStatus(c: Context, year: number) {
    const now = new Date()

    return await c.var.trx
      .updateTable("populations")
      .set({
        status: 1,
        updated_at: now,
        updated_by: c.var.user.id,
      })
      .where("deleted_at", "is", null)
      .where("year", "=", year)
      .executeTakeFirst()
  }
}
