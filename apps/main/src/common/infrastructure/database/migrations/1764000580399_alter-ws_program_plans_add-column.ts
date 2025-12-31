import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_program_plans
    ADD COLUMN status BOOLEAN NOT NULL AFTER is_active
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_program_plans
    DROP COLUMN status
  `.execute(db)
}
