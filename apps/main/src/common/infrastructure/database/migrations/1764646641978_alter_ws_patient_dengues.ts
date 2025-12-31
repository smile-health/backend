import type { Kysely } from 'kysely'
import { DB } from '../types/db.js';

export async function up(db: Kysely<DB>): Promise<void> {
	await db.executeQuery({
		sql: "ALTER TABLE `ws_patient_dengues` MODIFY COLUMN `input_date` DATE",
		parameters: []
	})
}

export async function down(db: Kysely<DB>): Promise<void> {
	await db.schema
		.alterTable("ws_patient_dengues")
		.alterColumn("input_date", (col) => col.dropDefault())
		.execute()
}
