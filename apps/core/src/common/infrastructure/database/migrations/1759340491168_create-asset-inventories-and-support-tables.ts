import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("asset_working_statuses")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createTable("asset_electricities")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createTable("asset_calibration_schedules")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createTable("asset_maintenance_schedules")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createTable("asset_inventories")
    .ifNotExists()
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("other_asset_type_name", "varchar(255)")
    .addColumn("other_asset_model_name", "varchar(255)")
    .addColumn("other_asset_manufacture_name", "varchar(255)")
    .addColumn("other_asset_budget_source_name", "varchar(255)")
    .addColumn("other_borrowed_from_entity_name", "varchar(255)")
    .addColumn("ownership_qty", "integer")
    .addColumn("serial_number", "varchar(255)")
    .addColumn("production_year", "integer")
    .addColumn("budget_year", "integer")
    .addColumn("ownership_status", "smallint", (col) => col.notNull().defaultTo(1))
    .addColumn("warranty_start_date", "date")
    .addColumn("warranty_end_date", "date")
    .addColumn("warranty_asset_vendor_id", "integer")
    .addColumn("borrowed_from_entity_id", "integer")
    .addColumn("budget_source_id", "integer")
    .addColumn("asset_model_id", "integer")
    .addColumn("asset_type_id", "integer")
    .addColumn("manufacture_id", "integer")
    .addColumn("entity_id", "integer")
    .addColumn("calibration_last_date", "date")
    .addColumn("calibration_schedule_id", "integer")
    .addColumn("calibration_asset_vendor_id", "integer")
    .addColumn("maintenance_last_date", "date")
    .addColumn("maintenance_schedule_id", "integer")
    .addColumn("maintenance_asset_vendor_id", "integer")
    .addColumn("status", "integer")
    .addColumn("working_status_id", "integer")
    .addColumn("electricity_id", "integer")
    .addColumn("asset_model_temperature_capacity_id", "integer")
    .addColumn("delete_reason", "text")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("asset_inventories").execute()
  await db.schema.dropTable("asset_working_statuses").execute()
  await db.schema.dropTable("asset_electricities").execute()
  await db.schema.dropTable("asset_calibration_schedules").execute()
  await db.schema.dropTable("asset_maintenance_schedules").execute()
}
