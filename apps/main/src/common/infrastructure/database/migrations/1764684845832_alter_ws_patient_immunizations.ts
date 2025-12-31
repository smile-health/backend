import type { Kysely } from 'kysely'
import { DB } from '../types/db.js';

export async function up(db: Kysely<DB>): Promise<void> {
	await db.schema
		.alterTable("ws_patient_immunizations")
		.addColumn("identity_type", "varchar(255)")
		.addColumn("parent_patient_id", "bigint")
		.execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
	await db.schema
		.alterTable("ws_patient_immunizations")
		.dropColumn("identity_type")
		.dropColumn("parent_patient_id")
		.execute()
}
