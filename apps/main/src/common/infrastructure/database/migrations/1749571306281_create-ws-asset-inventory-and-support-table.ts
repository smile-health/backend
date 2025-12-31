import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_asset_working_statuses")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  await db.schema
    .createTable("ws_asset_electricities")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  await db.schema
    .createTable("ws_asset_calibration_schedules")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  await db.schema
    .createTable("ws_asset_maintenance_schedules")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()

  await db.schema
    .createTable("ws_asset_inventories")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("asset_model_id", "bigint")
    .addColumn("asset_model_name", "varchar(255)", (col) => col.notNull())
    .addColumn("net_capacity", "double precision")
    .addColumn("gross_capacity", "double precision")
    .addColumn("asset_type_id", "bigint")
    .addColumn("asset_type_name", "varchar(255)", (col) => col.notNull())
    .addColumn("min_temperature", "double precision")
    .addColumn("max_temperature", "double precision")
    .addColumn("manufacture_id", "bigint")
    .addColumn("manufacture_name", "varchar(255)", (col) => col.notNull())
    .addColumn("serial_number", "varchar(255)", (col) => col.notNull())
    .addColumn("production_year", "integer", (col) => col.notNull())
    .addColumn("asset_working_status_id", "bigint")
    .addColumn("asset_working_status_name", "varchar(255)", (col) =>
      col.notNull()
    )
    .addColumn("entity_id", "bigint")
    .addColumn("entity_name", "varchar(255)", (col) => col.notNull())
    .addColumn("contact_person_user_1_id", "bigint", (col) => col.notNull())
    .addColumn("contact_person_user_1_name", "varchar(255)", (col) =>
      col.notNull()
    )
    .addColumn("contact_person_user_2_id", "bigint")
    .addColumn("contact_person_user_2_name", "varchar(255)")
    .addColumn("contact_person_user_3_id", "bigint")
    .addColumn("contact_person_user_3_name", "varchar(255)")
    .addColumn("ownership_status", "integer", (col) => col.notNull())
    .addColumn("borrowed_from_entity_id", "bigint")
    .addColumn("borrowed_from_entity_name", "varchar(255)")
    .addColumn("budget_year", "integer", (col) => col.notNull())
    .addColumn("budget_source_id", "bigint")
    .addColumn("budget_source_name", "varchar(255)", (col) => col.notNull())
    .addColumn("asset_electricity_id", "bigint")
    .addColumn("asset_electricity_name", "varchar(255)")
    .addColumn("warranty_start_date", "datetime")
    .addColumn("warranty_end_date", "datetime")
    .addColumn("warranty_asset_vendor_id", "bigint")
    .addColumn("warranty_asset_vendor_name", "varchar(255)")
    .addColumn("calibration_last_date", "datetime")
    .addColumn("calibration_schedule_id", "bigint")
    .addColumn("calibration_schedule_name", "varchar(255)")
    .addColumn("calibration_asset_vendor_id", "bigint")
    .addColumn("calibration_asset_vendor_name", "varchar(255)")
    .addColumn("maintenance_last_date", "datetime")
    .addColumn("maintenance_schedule_id", "bigint")
    .addColumn("maintenance_schedule_name", "varchar(255)")
    .addColumn("maintenance_asset_vendor_id", "bigint")
    .addColumn("maintenance_asset_vendor_name", "varchar(255)")
    .addColumn("status", "boolean", (col) => col.defaultTo(true))
    .addColumn("created_by", "bigint")
    .addColumn("updated_by", "bigint")
    .addColumn("created_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull()
    )
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_asset_working_statuses").execute()
  await db.schema.dropTable("ws_asset_electricities").execute()
  await db.schema.dropTable("ws_asset_calibration_schedules").execute()
  await db.schema.dropTable("ws_asset_maintenance_schedules").execute()
  await db.schema.dropTable("ws_asset_inventories").execute()
}
