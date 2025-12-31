import { Kysely, sql } from "kysely"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE populations ADD COLUMN province_id BIGINT NOT NULL AFTER entity_id`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE populations DROP COLUMN province_id`.execute(db)
}
