import type { Kysely } from "kysely"
import { DB } from "../types/db.js"

const tables = ["users", "entities", "master_materials", "manufactures", "source_materials"]

export async function up(db: Kysely<DB>): Promise<void> {
  for (const table of tables) {
    await db.schema.alterTable(table).addColumn("ws_global_id", "bigint").execute()
  }
}

export async function down(db: Kysely<DB>): Promise<void> {
  for (const table of tables) {
    await db.schema.alterTable(table).dropColumn("ws_global_id").execute()
  }
}
