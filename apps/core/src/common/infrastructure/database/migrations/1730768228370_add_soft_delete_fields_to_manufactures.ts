import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE manufactures ADD COLUMN deleted_at TIMESTAMP NULL AFTER updated_at`.execute(
    db
  )
  await sql`ALTER TABLE manufactures ADD COLUMN deleted_by BIGINT NULL AFTER updated_by`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("manufactures")
    .dropColumn("deleted_at")
    .dropColumn("deleted_by")
    .execute()
}
