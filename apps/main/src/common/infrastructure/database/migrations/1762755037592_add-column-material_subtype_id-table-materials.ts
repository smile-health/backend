import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE materials ADD COLUMN material_subtype_id BIGINT NULL AFTER material_type_id`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE materials DROP COLUMN material_subtype_id`.execute(db)
}
