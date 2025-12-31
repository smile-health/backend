import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_asset_inventories")
    .addColumn("other_budget_source_name", "varchar(255)")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_asset_inventories")
    .dropColumn("other_budget_source_name")
    .execute()
}
