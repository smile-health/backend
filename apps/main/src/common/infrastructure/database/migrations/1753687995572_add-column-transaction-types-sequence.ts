import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE ws_transaction_types ADD COLUMN sequence smallint AFTER enable`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_transaction_types")
    .dropColumn("sequence")
    .execute()
}
