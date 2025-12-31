import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_disposal_methods 
    ADD COLUMN status SMALLINT NOT NULL DEFAULT 1
    AFTER title
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_disposal_methods")
    .dropColumn("status")
    .execute()
}
