import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_orders")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("customer_id", "bigint", (col) => col.notNull())
    .addColumn("vendor_id", "bigint", (col) => col.notNull())
    .addColumn("order_status_id", "integer", (col) => col.notNull())
    .addColumn("order_type_id", "integer", (col) => col.notNull())
    .addColumn("activity_id", "integer")
    .addColumn("delivery_type_id", "integer")
    .addColumn("purchase_ref", "varchar(255)")
    .addColumn("sales_ref", "varchar(255)")
    .addColumn("delivery_number", "varchar(255)")
    .addColumn("device_type", "smallint")
    .addColumn("is_allocated", "boolean", (col) => col.defaultTo(false))
    .addColumn("taken_by_customer", "boolean", (col) => col.defaultTo(false))
    .addColumn("biofarma_changed", "boolean", (col) => col.defaultTo(null))
    .addColumn("no_document", "varchar(255)")
    .addColumn("notes", "text")
    .addColumn("no_po", "varchar(255)")
    .addColumn("total_order_items", "integer", (col) => col.defaultTo(1))
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_order_audits")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("order_id", "bigint", (col) => col.notNull())
    .addColumn("released_date", "datetime")
    .addColumn("required_date", "datetime")
    .addColumn("estimated_date", "datetime")
    .addColumn("actual_shipment_date", "datetime")
    .addColumn("confirmed_by", "integer")
    .addColumn("shipped_by", "integer")
    .addColumn("fulfilled_by", "integer")
    .addColumn("cancelled_by", "integer")
    .addColumn("allocated_by", "integer")
    .addColumn("confirmed_at", "datetime")
    .addColumn("shipped_at", "datetime")
    .addColumn("fulfilled_at", "datetime")
    .addColumn("cancelled_at", "datetime")
    .addColumn("allocated_at", "datetime")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_order_histories")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("order_id", "bigint", (col) => col.notNull())
    .addColumn("order_status_id", "integer", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_order_comments")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("order_id", "bigint", (col) => col.notNull())
    .addColumn("user_id", "bigint", (col) => col.notNull())
    .addColumn("order_status_id", "integer", (col) => col.notNull())
    .addColumn("comment", "text")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_order_item_stocks")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("order_id", "bigint", (col) => col.notNull())
    .addColumn("order_item_kfa_id", "integer")
    .addColumn("material_id", "integer", (col) => col.notNull())
    .addColumn("stock_id", "bigint")
    .addColumn("order_stock_status_id", "integer")
    .addColumn("qty", "double precision")
    .addColumn("ordered_qty", "double precision")
    .addColumn("allocated_qty", "double precision")
    .addColumn("confirmed_qty", "double precision")
    .addColumn("received_qty", "double precision")
    .addColumn("recommended_stock", "double precision")
    .addColumn("order_reason_id", "integer")
    .addColumn("fulfill_reason", "smallint")
    .addColumn("fulfill_status", "smallint")
    .addColumn("qrcode", "varchar(255)")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_order_item_projection_capacities")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("order_id", "integer", (col) => col.notNull())
    .addColumn("capacity_asset", "float8")
    .addColumn("total_volume", "float8")
    .addColumn("percent_capacity", "float8")
    .addColumn("is_confirm", "boolean")
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_order_reasons")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_order_types")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_order_statuses")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_order_other_reasons")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("order_id", "integer", (col) => col.notNull())
    .addColumn("order_item_stock_id", "integer", (col) => col.notNull())
    .addColumn("other_reason", "text")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await Promise.allSettled([
    db.schema.dropTable("ws_orders").execute(),
    db.schema.dropTable("ws_order_audits").execute(),
    db.schema.dropTable("ws_order_histories").execute(),
    db.schema.dropTable("ws_order_comments").execute(),
    db.schema.dropTable("ws_order_items").execute(),
    db.schema.dropTable("ws_order_item_stocks").execute(),
    db.schema.dropTable("ws_order_item_projection_capacities").execute(),
    db.schema.dropTable("ws_order_reasons").execute(),
    db.schema.dropTable("ws_order_types").execute(),
    db.schema.dropTable("ws_order_statuses").execute(),
    db.schema.dropTable("ws_order_other_reasons").execute(),
  ])
}
