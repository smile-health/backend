import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_loggers")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("serial_number", "varchar(255)")
    .addColumn("gsm_no", "varchar(255)")
    .addColumn("location", "varchar(255)")
    .addColumn("vendor", "varchar(255)")
    .addColumn("asset_id", "integer")
    .addColumn("position", "varchar(255)", (col) => col.notNull())
    .addColumn("min", "float4", (col) => col.notNull().defaultTo(0))
    .addColumn("max", "float4", (col) => col.notNull().defaultTo(0))
    .addColumn("temp", "varchar(255)", (col) => col.notNull().defaultTo('0.0'))
    .addColumn("status", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("prod_year", "varchar(255)", (col) => col.defaultTo('1990'))
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("loggers").execute()
}