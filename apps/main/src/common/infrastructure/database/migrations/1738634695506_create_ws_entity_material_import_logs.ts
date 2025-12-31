import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_entity_material_import_logs")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "integer", (col) => col.notNull())
    .addColumn("file", "varchar(255)", (col) => col.notNull())
    .addColumn("status", "smallint", (col) => col.notNull()) // Status dengan nilai terbatas
    .addColumn("notes", sql`mediumtext`, (col) => col.notNull()) // Errors sebagai array
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_entity_material_import_logs").execute()
}
