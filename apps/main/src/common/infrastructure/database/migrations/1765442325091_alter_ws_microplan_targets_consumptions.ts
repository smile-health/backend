import { Kysely, sql } from 'kysely'
import { DB } from '../types/db.js';

export async function up(db: Kysely<DB>): Promise<void> {
	await sql`
		ALTER TABLE ws_microplan_targets_consumptions
		ADD COLUMN target_group_id BIGINT NOT NULL DEFAULT 0 AFTER target_id
	`.execute(db)
}

export async function down(db: Kysely<DB>): Promise<void> {
	await sql`
		ALTER TABLE ws_microplan_targets_consumptions
		DROP COLUMN target_group_id
	`.execute(db)
}
