import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createIndex("idx_ws_annual_need_ipvs_unique")
    .on("ws_annual_need_ipvs")
    .columns(["material_id", "annual_need_id", "activity_id"])
    .unique()
    .execute()

  await db.schema
    .createIndex("idx_ws_annual_need_results_unique")
    .on("ws_annual_need_results")
    .columns([
      "material_id",
      "annual_need_id",
      "entity_id",
      "activity_id",
      "target_group_id",
    ])
	.unique()
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropIndex("idx_ws_annual_need_results_unique").on("ws_annual_need_results").execute()
  await db.schema.dropIndex("idx_ws_annual_need_ipvs_unique").on("ws_annual_need_ipvs").execute()
}
