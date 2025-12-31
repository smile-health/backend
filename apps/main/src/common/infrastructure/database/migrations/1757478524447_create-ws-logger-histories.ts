import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"
import { addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_logger_histories")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("device_code", "varchar(255)")
    .addColumn("temp", "float4")
    .addColumn("status", "integer")
    .addColumn("entity_id", "bigint")
    .addColumn("asset_id", "bigint")
    .addColumn("lat", "float4", (col) => col.defaultTo(0.0))
    .addColumn("long", "float4", (col) => col.defaultTo(0.0))
    .addColumn("actual_date", "datetime")
    .addColumn("status_device", "boolean", (col) => col.defaultTo(false).notNull())
    .addColumn("battery", "float4", (col) => col.defaultTo(0.0).notNull())
    .addColumn("signal", "float4", (col) => col.defaultTo(0.0).notNull())
    .addColumn("power", "boolean", (col) => col.defaultTo(false).notNull())
    .addColumn("working_status", "varchar(255)")
    .addColumn("max_temp", "decimal")
    .addColumn("min_temp", "decimal")
    .addColumn("logger_status", "varchar(255)")
    .addColumn("humidity", "float4")
    .$call(addTimestampColumns)
    .execute()

  // Add indexes for better query performance
  await db.schema
    .createIndex("idx_ws_logger_histories_device_code")
    .on("ws_logger_histories")
    .column("device_code")
    .execute()

  await db.schema
    .createIndex("idx_ws_logger_histories_entity_id")
    .on("ws_logger_histories")
    .column("entity_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_logger_histories_asset_id")
    .on("ws_logger_histories")
    .column("asset_id")
    .execute()

  await db.schema
    .createIndex("idx_ws_logger_histories_created_at")
    .on("ws_logger_histories")
    .column("created_at")
    .execute()

  await db.schema
    .createIndex("idx_ws_logger_histories_actual_date")
    .on("ws_logger_histories")
    .column("actual_date")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_logger_histories").execute()
}