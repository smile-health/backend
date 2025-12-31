import type { Kysely } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("asset_inventory_rtmds")
    .addColumn("description", "varchar(255)")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("asset_inventory_rtmds")
    .dropColumn("description")
    .execute()
}
