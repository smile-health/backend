import type { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addAuditColumns, addTimestampColumns } from "../helper"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("asset_rtmd_statuses")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createTable("asset_rtmds")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("asset_type_id", "integer")
    .addColumn("asset_model_id", "integer")
    .addColumn("manufacture_id", "integer")
    .addColumn("asset_vendor_id", "integer")
    .addColumn("asset_communication_provider_id", "integer")
    .addColumn("serial_number", "varchar(255)")
    .addColumn("production_year", "integer")
    .addColumn("asset_rtmd_status_id", "integer")
    .addColumn("entity_id", "integer")
    .addColumn("budget_year", "integer")
    .addColumn("budget_source_id", "integer")
    .addColumn("status", "integer")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createTable("contact_persons")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)")
    .addColumn("phone", "varchar(255)")
    .addColumn("source_id", "integer")
    .addColumn("source_type", "varchar(50)")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("contact_persons").execute()
  await db.schema.dropTable("asset_rtmds").execute()
  await db.schema.dropTable("asset_rtmd_statuses").execute()
}
