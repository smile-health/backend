import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_protocols")
	.addColumn("is_kipi", "smallint", (col) => col.defaultTo(0))
	.addColumn("is_medical_history", "smallint", (col) => col.defaultTo(0))
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_protocols")
	.dropColumn("is_kipi")
	.dropColumn("is_medical_history")
	.execute()
}
