import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
		ALTER TABLE ws_material_ratios
			MODIFY COLUMN from_material_qty DOUBLE NOT NULL,
			MODIFY COLUMN to_material_qty DOUBLE NOT NULL,
			ADD UNIQUE KEY idx_ws_material_ratios_program_materials (
				program_plan_id,
				from_material_id,
				to_material_id
			)
	`.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
		ALTER TABLE ws_material_ratios
			MODIFY COLUMN from_material_qty BIGINT NOT NULL,
			MODIFY COLUMN to_material_qty BIGINT NOT NULL,
			DROP INDEX idx_ws_material_ratios_program_materials
	`.execute(db)
}
