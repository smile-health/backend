import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_vaccine_sequences")
	.addColumn("next_duration", "integer")
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_vaccine_sequences")
	.dropColumn("next_duration")
	.execute()
}
