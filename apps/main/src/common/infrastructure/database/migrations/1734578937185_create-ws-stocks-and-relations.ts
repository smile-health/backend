import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_stocks")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("batch_id", "bigint")
    .addColumn("entity_id", "bigint", (col) => col.notNull())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("parent_material_id", "bigint")
    .addColumn("activity_id", "bigint", (col) => col.notNull())
    .addColumn("budget_source_id", "bigint")
    .addColumn("qty", "double precision", (col) => col.notNull())
    .addColumn("allocated_qty", "double precision", (col) => col.defaultTo(0))
    .addColumn("in_transit_qty", "double precision", (col) => col.defaultTo(0))
    .addColumn("unreceived_qty", "double precision", (col) => col.defaultTo(0))
    .addColumn("exterminated_qty", "double precision", (col) =>
      col.defaultTo(0)
    )
    .addColumn("open_vial_qty", "double precision", (col) => col.defaultTo(0))
    .addColumn("status", "smallint")
    .addColumn("year", "smallint")
    .addColumn("price", "double precision", (col) => col.defaultTo(0))
    .addColumn("total_price", "double precision", (col) => col.defaultTo(0))
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_stock_exterminations")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("stock_id", "bigint")
    .addColumn("transaction_reason_id", "integer")
    .addColumn("extermination_discard_qty", "double precision", (col) =>
      col.defaultTo(0)
    )
    .addColumn("extermination_received_qty", "double precision", (col) =>
      col.defaultTo(0)
    )
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await Promise.all([
    db.schema.dropTable("ws_stocks").execute(),
    db.schema.dropTable("ws_stock_exterminations").execute(),
  ])
}
