import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE materials DROP INDEX hierarchy_code
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE materials ADD UNIQUE INDEX hierarchy_code (hierarchy_code)
  `.execute(db)
}
