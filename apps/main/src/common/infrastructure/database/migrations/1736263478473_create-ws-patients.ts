import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_patients")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("nik", "varchar(255)")
    .addColumn("vaccine_sequence", "smallint")
    .addColumn("last_vaccine_at", "datetime")
    .addColumn("entity_id", "bigint")
    .addColumn("identity_type", "smallint")
    .addColumn("preexposure_sequence", "smallint")
    .addColumn("last_preexposure_at", "datetime")
    .addColumn("stop_notification", "smallint")
    .addColumn("phone_number", "varchar(255)")
    .addColumn("vaccine_method", "smallint")
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_patients").execute()
}
