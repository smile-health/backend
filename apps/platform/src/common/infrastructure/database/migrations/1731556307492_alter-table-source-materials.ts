import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
  await sql`ALTER TABLE source_materials ADD COLUMN created_by int(11) NULL AFTER created_at`.execute(
    db
  )
  await sql`ALTER TABLE source_materials ADD COLUMN updated_by int(11) NULL AFTER created_by`.execute(
    db
  )
  await sql`ALTER TABLE source_materials ADD COLUMN global_id bigint NULL AFTER updated_by`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("source_materials")
    .dropColumn("created_by")
    .dropColumn("updated_by")
    .dropColumn("global_id")
    .execute()
}
