import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE ws_consumptions MODIFY vaccine_type_id INTEGER NULL`.execute(
	db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE ws_consumptions MODIFY vaccine_type_id INTEGER NOT NULL`.execute(
	db
  )
}
