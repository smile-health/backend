import { type Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_patient_import_logs")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "integer", (col) => col.notNull())
    .addColumn("file", "varchar(255)", (col) => col.notNull())
    .addColumn("status", "smallint", (col) => col.notNull())
    .addColumn("notes", "json", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_patient_import_logs").execute()
}
