import type { Kysely } from "kysely"
import { sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE ws_microplan_targets_consumptions MODIFY COLUMN material_id BIGINT NULL`.execute(
    db
  )
  await sql`ALTER TABLE ws_microplan_targets_consumptions MODIFY COLUMN material_target_id BIGINT NULL`.execute(
    db
  )
  await sql`ALTER TABLE ws_microplan_targets_consumptions ADD COLUMN end_ideal_days INT AFTER start_ideal_days`.execute(
    db
  )
  await sql`ALTER TABLE ws_microplan_targets_consumptions ADD COLUMN end_ideal_date DATE AFTER ideal_date`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE ws_microplan_targets_consumptions MODIFY COLUMN material_id BIGINT NOT NULL`.execute(
    db
  )
  await sql`ALTER TABLE ws_microplan_targets_consumptions MODIFY COLUMN material_target_id BIGINT NOT NULL`.execute(
    db
  )
  await sql`ALTER TABLE ws_microplan_targets_consumptions DROP COLUMN end_ideal_days`.execute(
    db
  )
  await sql`ALTER TABLE ws_microplan_targets_consumptions DROP COLUMN end_ideal_date`.execute(
    db
  )
}
