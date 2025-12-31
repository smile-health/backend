import { Kysely, sql } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE populations ADD UNIQUE KEY unique_target_group_year_entity (target_group_id, year, entity_id)`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE populations DROP INDEX unique_target_group_year_entity`.execute(
    db
  )
}
