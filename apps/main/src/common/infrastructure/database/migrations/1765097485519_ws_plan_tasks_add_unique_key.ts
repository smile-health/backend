import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
		ALTER TABLE ws_plan_tasks
			ADD UNIQUE KEY idx_ws_plan_tasks_program_material_activity_target_group (
				program_plan_id,
				material_id,
				activity_id,
				target_group_id
			)
	`.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
		ALTER TABLE ws_plan_tasks
			DROP INDEX idx_ws_plan_tasks_program_material_activity_target_group
	`.execute(db)
}
