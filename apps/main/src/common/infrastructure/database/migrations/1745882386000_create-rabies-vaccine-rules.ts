import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("rabies_vaccine_rules")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("type_id", "integer", (col) => col.notNull())
    .addColumn("method_id", "integer", (col) => col.notNull())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("min", "integer", (col) => col.notNull())
    .addColumn("max", "integer", (col) => col.notNull())
    .addColumn("previous_sequence", "integer")
    .addColumn("active_duration", "integer")
    .addColumn("next_sequence", "varchar(255)")
    .addColumn("start_notification", "integer")
    .addColumn("end_notification", "integer")
    .addColumn("prerequisite_qty", "integer")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("rabies_vaccine_rules").execute()
}
