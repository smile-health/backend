import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_material_activities")
	.addColumn("created_by", "bigint")
	.addColumn("updated_by", "bigint")
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_material_activities")
	.dropColumn("created_by")
	.dropColumn("updated_by")
	.execute()
}
