/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("ws_stock_opnames")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("period_id", "bigint")
    .addColumn("entity_id", "bigint", (col) => col.notNull())
    .addColumn("material_id", "integer")
    .addColumn("parent_material_id", "integer")
    .addColumn("activity_id", "integer")
    .addColumn("stock_id", "bigint", (col) => col.defaultTo(0))
    .addColumn("manufacture_id", "integer")
    .addColumn("batch_code", "varchar(255)", (col) => col.defaultTo(""))
    .addColumn("production_date", "datetime")
    .addColumn("expired_date", "datetime")
    .addColumn("recorded_qty", "double precision", (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn("in_transit_qty", "double precision", (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn("actual_qty", "double precision", (col) =>
      col.notNull().defaultTo(0)
    )
    .addColumn("is_within_period", "smallint")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .addUniqueConstraint("stock_opname_unique_index", [
      "period_id",
      "entity_id",
      "material_id",
      "activity_id",
      "stock_id",
      "batch_code",
    ])
    .execute()

  await db.schema
    .createTable("ws_stock_opname_periods")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("program_id", "integer")
    .addColumn("start_date", "datetime")
    .addColumn("end_date", "datetime")
    .addColumn("month_period", "integer")
    .addColumn("year_period", "integer")
    .addColumn("status", "smallint", (col) => col.defaultTo(0))
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .addUniqueConstraint("month_year_unique_index", [
      "program_id",
      "month_period",
      "year_period",
    ])
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("ws_stock_opname_periods").execute()
  await db.schema.dropTable("ws_stock_opnames").execute()
}
