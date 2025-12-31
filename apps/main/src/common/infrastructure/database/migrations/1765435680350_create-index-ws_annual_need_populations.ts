import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.createIndex("idx_ws_annual_need_populations_unique")
	.on("ws_annual_need_populations")
	.columns(["target_group_id", "annual_need_id", "entity_id"])
	.unique()
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropIndex("idx_ws_annual_need_populations_unique").on("ws_annual_need_populations").execute()
}
