import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_consumptions")
	.addColumn("reference_consumption_id", "bigint")
	.addColumn("return_transaction_id", "bigint")
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("ws_consumptions")
	.dropColumn("reference_consumption_id")
	.dropColumn("return_transaction_id")
	.execute()
}
