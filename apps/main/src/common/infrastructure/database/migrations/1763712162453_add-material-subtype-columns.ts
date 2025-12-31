import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
		ALTER TABLE ws_material_ratios
		ADD COLUMN from_subtype_id BIGINT NULL AFTER program_plan_id,
		ADD COLUMN to_subtype_id BIGINT NULL AFTER from_material_qty
	`.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
		ALTER TABLE ws_material_ratios
		DROP COLUMN to_subtype_id,
		DROP COLUMN from_subtype_id
	`.execute(db)
}
