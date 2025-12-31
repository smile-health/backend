import Database from "bun:sqlite"
import { Kysely } from "kysely"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("budget_source_workspaces")
    .addColumn("status", "smallint", (col) => col.notNull().defaultTo(1))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("budget_source_workspaces")
    .dropColumn("status")
    .execute()
}
