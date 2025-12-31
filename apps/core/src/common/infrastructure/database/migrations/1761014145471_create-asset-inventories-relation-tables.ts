/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper"

export async function up(db: Kysely<any>): Promise<void> {
  // Table: inventories_temperature_capacities
  await db.schema
    .createTable("asset_inventory_temperature_capacity_histories")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("asset_inventory_id", "bigint", (col) => col.notNull())
    .addColumn("asset_model_temperature_capacity_id", "integer", (col) =>
      col.notNull()
    )
    .addUniqueConstraint("unique_inventory_temperature_capacity", [
      "asset_inventory_id",
      "asset_model_temperature_capacity_id",
    ])
    .$call(addTimestampColumns)
    .execute()

  // Table: asset_inventory_other_capacities
  await db.schema
    .createTable("asset_inventory_other_capacities")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("asset_inventory_id", "bigint", (col) => col.notNull())
    .addColumn("gross", "double precision")
    .addColumn("net", "double precision")
    .addColumn("max_temperature", "double precision")
    .addColumn("min_temperature", "double precision")
    .$call(addTimestampColumns)
    .execute()

  // Table: asset_rtmd_histories
  await db.schema
    .createTable("asset_rtmd_histories")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("asset_rtmd_id", "bigint", (col) => col.notNull())
    .addColumn("asset_model_temperature_capacity_id", "bigint")
    .addColumn("temperature", "double precision")
    .addColumn("humidity", "double precision")
    .addColumn("battery", "double precision")
    .addColumn("signal", "double precision")
    .addColumn("latitude", "double precision")
    .addColumn("longitude", "double precision")
    .addColumn("device_status", "smallint")
    .addColumn("is_power_connected", "smallint")
    .addColumn("inventory_working_status_id", "smallint")
    .addColumn("rtmd_status_id", "smallint")
    .addColumn("actual_time", "timestamp")
    .$call(addTimestampColumns)
    .execute()

  // Table: inventories_rtmds
  await db.schema
    .createTable("asset_inventory_rtmds")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("asset_inventory_id", "bigint", (col) => col.notNull())
    .addColumn("asset_rtmd_id", "bigint", (col) => col.notNull())
    .addColumn("sensor_qty", "integer")
    .addUniqueConstraint("unique_inventory_rtmd", [
      "asset_inventory_id",
      "asset_rtmd_id",
    ])
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("asset_inventory_rtmds").ifExists().execute()
  await db.schema.dropTable("asset_rtmd_histories").ifExists().execute()
  await db.schema
    .dropTable("asset_inventory_other_capacities")
    .ifExists()
    .execute()
  await db.schema
    .dropTable("asset_inventory_temperature_capacity_histories")
    .ifExists()
    .execute()
}
