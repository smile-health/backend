import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE locations ADD INDEX idx_parent_id (parent_id);
  `.execute(db)

  await sql`
    ALTER TABLE locations ADD INDEX idx_level (level);
`.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropIndex("idx_parent_id").execute()
  await db.schema.dropIndex("idx_level").execute()
}
