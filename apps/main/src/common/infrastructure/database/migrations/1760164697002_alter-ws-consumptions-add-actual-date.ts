import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_consumptions
    ADD COLUMN actual_date DATETIME NULL AFTER expired_date;
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_consumptions
    DROP COLUMN actual_date;
  `.execute(db)
}
