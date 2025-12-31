import type { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addAuditColumns, addTimestampColumns } from "../helper"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("asset_models_temperatures_capacities")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("asset_model_id", "bigint", (col) =>
      col.notNull().references("asset_models.id").onDelete("cascade")
    )
    .addColumn("asset_type_temperature_id", "bigint", (col) =>
      col
        .notNull()
        .references("asset_types_temperatures.id")
        .onDelete("cascade")
    )
    .addColumn("net_capacity", "double precision")
    .addColumn("gross_capacity", "double precision")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("asset_models_temperatures_capacities").execute()
}
