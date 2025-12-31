import { Context } from "hono"
import { sql } from "kysely"

export class PopulationExcelRepository {
  async createOrUpdatePopulation(
    c: Context,
    data: {
      target_group_id: number
      year: number
      entity_id: number
      province_id: number
      population_number: number
      user_id: number
    }
  ) {
    return await c.var.trx
      .insertInto("populations")
      .values({
        target_group_id: data.target_group_id,
        year: data.year,
        entity_id: data.entity_id,
        province_id: data.province_id,
        population_number: data.population_number,
        created_by: data.user_id,
        updated_by: data.user_id,
      })
      .onDuplicateKeyUpdate({
        province_id: data.province_id,
        population_number: data.population_number,
        updated_by: data.user_id,
      })
      .executeTakeFirst()
  }

  async getExportRows(
    c: Context,
    params: { year: number; province_id: number }
  ) {
    const { year, province_id } = params

    const rows = await c.var.trx
      .selectFrom("populations as p")
      .innerJoin("entities as e", "e.id", "p.entity_id")
      .innerJoin("target_groups as tg", "tg.id", "p.target_group_id")
      .where("p.deleted_at", "is", null)
      .where("p.year", "=", year)
      .where("p.province_id", "=", province_id)
      .select([
        sql<number>`e.id`.as("entity_id"),
        sql<string>`e.name`.as("entity_name"),
        sql<number>`tg.id`.as("target_group_id"),
        sql<string>`tg.title`.as("target_group_title"),
        sql<number>`SUM(p.population_number)`.as("population_number"),
        sql<number | null>`MAX(p.updated_by)`.as("updated_by"),
      ])
      .groupBy(["e.id", "e.name", "tg.id", "tg.title"])
      .orderBy("e.id")
      .execute()

    return rows
  }
}
