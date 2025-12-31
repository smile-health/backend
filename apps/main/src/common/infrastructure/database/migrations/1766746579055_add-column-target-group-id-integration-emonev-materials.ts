import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE integration_emonev_materials
    ADD COLUMN target_group_id BIGINT NULL AFTER material_id
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE integration_emonev_materials
    DROP COLUMN target_group_id
  `.execute(db)
}
