import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE populations ADD COLUMN status TINYINT(1) NOT NULL DEFAULT 0 AFTER population_number`.execute(
    db
  )
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`ALTER TABLE populations DROP COLUMN status`.execute(db)
}
