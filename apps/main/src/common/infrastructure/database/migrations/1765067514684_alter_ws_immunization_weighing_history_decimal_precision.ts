import { Kysely, sql } from 'kysely'
import { DB } from '../types/db.js';

export async function up(db: Kysely<DB>): Promise<void> {
	await sql`
    ALTER TABLE ws_immunization_weighing_history
    MODIFY COLUMN weight DECIMAL(10, 2),
    MODIFY COLUMN height DECIMAL(10, 2),
    MODIFY COLUMN z_score_weight DECIMAL(10, 2),
    MODIFY COLUMN z_score_height DECIMAL(10, 2),
    MODIFY COLUMN z_score_bmi DECIMAL(10, 2)
  `.execute(db)
}

export async function down(db: Kysely<DB>): Promise<void> {
	await sql`
    ALTER TABLE ws_immunization_weighing_history
    MODIFY COLUMN weight DECIMAL,
    MODIFY COLUMN height DECIMAL,
    MODIFY COLUMN z_score_weight DECIMAL,
    MODIFY COLUMN z_score_height DECIMAL,
    MODIFY COLUMN z_score_bmi DECIMAL
  `.execute(db)
}
