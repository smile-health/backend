import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_annual_need_results")
	.addColumn("yearly_need_vial", "double precision")
	.addColumn("monthly_need_vial", "double precision")
	.addColumn("weekly_need_vial", "double precision")
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_annual_need_results")
	.dropColumn("yearly_need_vial")
	.dropColumn("monthly_need_vial")
	.dropColumn("weekly_need_vial")
	.execute()
}
