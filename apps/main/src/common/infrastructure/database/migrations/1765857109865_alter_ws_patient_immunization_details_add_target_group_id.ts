import { Kysely, sql } from 'kysely'
import { DB } from '../types/db.js'

export async function up(db: Kysely<DB>): Promise<void> {
	await sql`
		ALTER TABLE ws_patient_immunization_details
		ADD COLUMN target_group_id BIGINT NOT NULL DEFAULT 0 AFTER material_target_id
	`.execute(db)
}

export async function down(db: Kysely<DB>): Promise<void> {
	await sql`
		ALTER TABLE ws_patient_immunization_details
		DROP COLUMN target_group_id
	`.execute(db)
}
