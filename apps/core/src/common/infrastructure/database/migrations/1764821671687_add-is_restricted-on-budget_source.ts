import type { Kysely } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("budget_sources")
    .addColumn("is_restricted", "boolean", (col) => col.defaultTo(false))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("budget_sources")
    .dropColumn("is_restricted")
    .execute()
}
