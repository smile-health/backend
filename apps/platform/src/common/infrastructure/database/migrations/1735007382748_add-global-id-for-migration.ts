import type { Kysely } from "kysely"
import { DB } from "../types/db.js"

const tables = [
  "master_activities",
  "entity_master_material_activities",
  "batches",
  "stocks",
  "stock_exterminations",
  "orders",
  "transactions",
  "patients",
  "transaction_reasons",
]

export async function up(db: Kysely<DB>): Promise<void> {
  for (const table of tables) {
    await db.schema.alterTable(table).addColumn("global_id", "bigint").execute()
  }
  await db.schema
    .alterTable("master_activities")
    .addColumn("program_id", "bigint")
    .execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
  for (const table of tables) {
    await db.schema.alterTable(table).dropColumn("global_id").execute()
  }
  await db.schema
    .alterTable("master_activities")
    .dropColumn("program_id")
    .execute()
}
