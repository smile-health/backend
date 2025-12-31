import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_protocols")
	.addColumn("is_identity_type", "smallint", (col) => col.defaultTo(0))
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_protocols")
	.dropColumn("is_identity_type")
	.execute()
}
