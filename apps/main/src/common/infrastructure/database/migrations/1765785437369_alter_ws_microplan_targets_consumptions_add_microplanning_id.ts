import { Kysely, sql } from 'kysely'
import { DB } from '../types/db.js';

export async function up(db: Kysely<DB>): Promise<void> {
	await sql`
			ALTER TABLE ws_microplan_targets_consumptions
			ADD COLUMN microplanning_id BIGINT NOT NULL DEFAULT 0 AFTER material_target_id
		`.execute(db)
}

export async function down(db: Kysely<DB>): Promise<void> {
	await sql`
		ALTER TABLE ws_microplan_targets_consumptions
		DROP COLUMN microplanning_id
	`.execute(db)
}
