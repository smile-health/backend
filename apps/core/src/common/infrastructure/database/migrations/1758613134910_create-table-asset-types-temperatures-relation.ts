import type { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addAuditColumns, addTimestampColumns } from "../helper"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("temperature_thresholds")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("min_temperature", "double precision")
    .addColumn("max_temperature", "double precision")
    .addColumn("is_predefined", "boolean", (col) => col.defaultTo(false))
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createTable("asset_types_temperatures")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("asset_type_id", "bigint", (col) =>
      col.notNull().references("asset_types.id").onDelete("cascade")
    )
    .addColumn("temperature_threshold_id", "bigint", (col) =>
      col.notNull().references("temperature_thresholds.id").onDelete("cascade")
    )
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("asset_types_temperatures").execute()
  await db.schema.dropTable("temperature_thresholds").execute()
}
