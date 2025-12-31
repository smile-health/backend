import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.alterTable("users").dropColumn("deleted_at").execute()
}
