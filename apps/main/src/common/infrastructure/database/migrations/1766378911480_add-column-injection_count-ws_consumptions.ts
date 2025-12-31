import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_consumptions")
	.addColumn("injection_count", "smallint", (col)=> col.defaultTo(1))
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_consumptions")
	.dropColumn("injection_count")
	.execute()
}
