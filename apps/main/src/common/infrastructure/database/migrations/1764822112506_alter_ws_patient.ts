import { Kysely, sql } from 'kysely'
import { DB } from '../types/db.js';

export async function up(db: Kysely<DB>): Promise<void> {
	await sql`
    ALTER TABLE ws_patients
    ADD COLUMN residential_pos_code VARCHAR(255) AFTER residential_village_id
  `.execute(db)
}

export async function down(db: Kysely<DB>): Promise<void> {
	await sql`
    ALTER TABLE ws_patients
    DROP COLUMN residential_pos_code
  `.execute(db)
}
