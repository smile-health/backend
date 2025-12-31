import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const tables = [
    "mapping_users",
    "mapping_entities", 
    "mapping_budget_sources",
    "mapping_manufactures",
    "mapping_materials"
  ]

  await Promise.all(
    tables.map(async (table) => {
      await db.schema
        .alterTable(table)
        .addColumn("platform_global_id", "bigint")
        .execute()
    })
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  const tables = [
    "mapping_users",
    "mapping_entities", 
    "mapping_budget_sources",
    "mapping_manufactures",
    "mapping_materials"
  ]

  await Promise.all(
    tables.map(async (table) => {
      await db.schema
        .alterTable(table)
        .dropColumn("platform_global_id")
        .execute()
    })
  )
}
