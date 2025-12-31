import { Kysely, sql } from 'kysely'
import { DB } from '../types/db.js';

export async function up(db: Kysely<DB>): Promise<void> {
	await sql`
    ALTER TABLE ws_specimens
    MODIFY COLUMN equipment_id VARCHAR(255),
    MODIFY COLUMN reagent_id VARCHAR(255)
  `.execute(db)
}

export async function down(db: Kysely<DB>): Promise<void> {
	await sql`
    ALTER TABLE ws_specimens
    MODIFY COLUMN equipment_id BIGINT,
    MODIFY COLUMN reagent_id BIGINT
  `.execute(db)
}
