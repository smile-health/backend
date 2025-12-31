import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE ws_consumptions ADD COLUMN protocol VARCHAR(255) AFTER patient_id`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.alterTable("ws_consumptions").dropColumn("protocol").execute()
}
