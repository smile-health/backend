import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE target_groups
    ADD COLUMN age_max BIGINT NOT NULL DEFAULT 0 AFTER is_active,
    ADD COLUMN age_min BIGINT NOT NULL DEFAULT 0 AFTER is_active
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE target_groups
    DROP COLUMN age_max,
    DROP COLUMN age_min,
  `.execute(db)
}
