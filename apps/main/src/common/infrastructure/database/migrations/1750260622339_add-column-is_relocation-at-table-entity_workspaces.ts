import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("entity_workspaces")
    .addColumn("is_relocation", "smallint", (col) => col.notNull().defaultTo(0))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("entity_workspaces")
    .dropColumn("is_relocation")
    .execute()
}
