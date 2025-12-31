import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("vaccine_methods")
	.addColumn("is_multi_patient", "smallint", (col) => col.defaultTo(0))
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
	.alterTable("vaccine_methods")
	.dropColumn("is_multi_patient")
	.execute()
}
