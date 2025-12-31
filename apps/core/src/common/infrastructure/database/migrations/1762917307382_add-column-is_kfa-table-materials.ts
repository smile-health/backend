import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE materials ADD COLUMN is_kfa TINYINT(1) NOT NULL DEFAULT 1`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.alterTable("materials").dropColumn("is_kfa").execute()
}
