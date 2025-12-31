import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_consumptions")
	.addColumn("next_vaccine_date", "date")
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_consumptions")
	.dropColumn("next_vaccine_date")
	.execute()
}
