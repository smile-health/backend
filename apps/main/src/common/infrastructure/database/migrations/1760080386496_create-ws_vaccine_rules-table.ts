import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_vaccine_rules")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("protocol_id", "bigint", (col) => col.notNull())
    .addColumn("previous_sequence", "integer")
    .addColumn("next_sequence", "integer")
    .addColumn("before_sequence", "integer")
    .addColumn("other_sequences", "varchar(255)")
    .addColumn("prerequisite_qty", "integer")
    .addColumn("prerequisite_age", "integer")
    .addColumn("prerequisite_interval", "integer")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_vaccine_rules").execute()
}
