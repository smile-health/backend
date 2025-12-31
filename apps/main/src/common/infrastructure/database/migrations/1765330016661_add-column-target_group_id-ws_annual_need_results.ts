import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_annual_need_results")
    .addColumn("target_group_id", "bigint")
    .addColumn("dependent_material_id", "bigint")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_annual_need_results")
    .dropColumn("target_group_id")
    .dropColumn("dependent_material_id")
    .execute()
}
