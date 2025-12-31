import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_plan_tasks
      ADD COLUMN code varchar(255) NOT NULL AFTER id,
      ADD COLUMN target_group_id bigint NOT NULL AFTER month_distribution,
      ADD COLUMN number_of_dose double NOT NULL AFTER target_group_id
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_plan_tasks
      DROP COLUMN number_of_dose,
      DROP COLUMN target_group_id,
      DROP COLUMN code
  `.execute(db)
}
