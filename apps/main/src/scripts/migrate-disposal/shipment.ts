import { DB } from "@/common/infrastructure/database/types/db.js"
import { Kysely, sql } from "kysely"

export async function up(db: Kysely<DB>): Promise<void> {
  // Main table: ws_disposal_shipments
  await db.schema
    .createTable("ws_disposal_shipments")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("activity_id", "bigint", (col) => col.notNull())
    .addColumn("customer_id", "bigint", (col) => col.notNull())
    .addColumn("vendor_id", "bigint", (col) => col.notNull())
    .addColumn("status", "smallint", (col) => col.notNull())
    .addColumn("type", "smallint", (col) => col.notNull())
    .addColumn("no_document", "varchar(255)", (col) => col)
    .addColumn("comments", "text", (col) => col)
    .addColumn("shipped_at", "datetime", (col) => col)
    .addColumn("fulfilled_at", "datetime", (col) => col)
    .addColumn("cancelled_at", "datetime", (col) => col)
    .addColumn("created_by", "bigint", (col) => col.notNull())
    .addColumn("updated_by", "bigint", (col) => col)
    .addColumn("created_at", "datetime", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("updated_at", "datetime", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute()

  // Items table: ws_disposal_shipment_items
  await db.schema
    .createTable("ws_disposal_shipment_items")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("disposal_shipment_id", "bigint", (col) =>
      col.notNull().references("ws_disposal_shipments.id")
    )
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("qty", "double precision", (col) => col.notNull())
    .addColumn("confirmed_qty", "double precision", (col) => col)
    .addColumn("notes", "text", (col) => col)
    .addColumn("created_by", "bigint", (col) => col.notNull())
    .addColumn("created_at", "datetime", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("updated_at", "datetime", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute()

  // Stocks table: ws_disposal_shipment_stocks
  await db.schema
    .createTable("ws_disposal_shipment_stocks")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("disposal_shipment_item_id", "bigint", (col) =>
      col.notNull().references("ws_disposal_shipment_items.id")
    )
    .addColumn("stock_id", "bigint", (col) => col.notNull())
    .addColumn("batch_id", "bigint", (col) => col)
    .addColumn("activity_id", "bigint", (col) => col)
    .addColumn("stock_qty", "double precision", (col) => col)
    .addColumn("received_qty", "double precision", (col) => col)
    .addColumn("discard_qty", "double precision", (col) => col)
    .addColumn("transaction_reason_id", "integer", (col) => col)
    .addColumn("created_by", "bigint", (col) => col.notNull())
    .addColumn("created_at", "datetime", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("updated_at", "datetime", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute()

  // Comments table: ws_disposal_shipment_comments
  await db.schema
    .createTable("ws_disposal_shipment_comments")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("disposal_shipment_id", "bigint", (col) =>
      col.notNull().references("ws_disposal_shipments.id")
    )
    .addColumn("comment", "text", (col) => col)
    .addColumn("status", "smallint", (col) => col)
    .addColumn("user_id", "bigint", (col) => col.notNull())
    .addColumn("created_at", "datetime", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("ws_disposal_shipment_comments").execute()
  await db.schema.dropTable("ws_disposal_shipment_stocks").execute()
  await db.schema.dropTable("ws_disposal_shipment_items").execute()
  await db.schema.dropTable("ws_disposal_shipments").execute()
}
