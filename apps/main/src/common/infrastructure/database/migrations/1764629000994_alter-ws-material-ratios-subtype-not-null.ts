import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_material_ratios
      MODIFY COLUMN from_subtype_id BIGINT NOT NULL,
      MODIFY COLUMN to_subtype_id BIGINT NOT NULL
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_material_ratios
      MODIFY COLUMN from_subtype_id BIGINT NULL,
      MODIFY COLUMN to_subtype_id BIGINT NULL
  `.execute(db)
}
