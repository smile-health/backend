import type { Kysely } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("material_levels")
		.addColumn("enable", "integer", (col) => col.defaultTo(0))
		.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("material_levels")
		.dropColumn("enable")
		.execute()
}
