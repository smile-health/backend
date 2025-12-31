import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_vaccine_rules")
	.addColumn("deleted_at", "datetime")
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_vaccine_rules")
	.dropColumn("deleted_at")
	.execute()
}
