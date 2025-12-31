import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

const tables = [
  "mapping_users",
  "mapping_entities",
  "mapping_budget_sources",
  "mapping_manufactures",
  "mapping_materials",
]
export async function up(db: Kysely<Database>): Promise<void> {
  await Promise.all(
    tables.map(async (table) => {
      await db.schema
        .alterTable(table)
        .addUniqueConstraint(`${table}_program_id_unique`, [
          "platform_global_id",
          "program_id",
        ])
        .execute()
    })
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await Promise.all(
    tables.map(async (table) => {
      await db.schema
        .alterTable(table)
        .dropConstraint(`${table}_program_id_unique`)
        .execute()
    })
  )
}
