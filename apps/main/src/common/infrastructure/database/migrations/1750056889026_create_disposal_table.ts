import type { Kysely } from "kysely"
import type { Database } from "../types/index.js"
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // Create disposal_transaction_types table
  await db.schema
    .createTable("ws_disposal_transaction_types")
    .ifNotExists()
    .addColumn("id", "integer", (col) =>
      col.autoIncrement().primaryKey().unsigned()
    )
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  // Create disposal_methods table
  await db.schema
    .createTable("ws_disposal_methods")
    .ifNotExists()
    .addColumn("id", "integer", (col) =>
      col.autoIncrement().primaryKey().unsigned()
    )
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  // Create disposal_stocks table
  await db.schema
    .createTable("ws_disposal_stocks")
    .ifNotExists()
    .addColumn("id", "bigint", (col) =>
      col.autoIncrement().primaryKey().unsigned()
    )
    .addColumn("stock_id", "bigint", (col) => col.notNull())
    .addColumn("transaction_reason_id", "bigint", (col) => col.notNull())
    .addColumn("disposal_discard_qty", "double precision", (col) =>
      col.defaultTo(0)
    )
    .addColumn("disposal_received_qty", "double precision", (col) =>
      col.defaultTo(0)
    )
    .addColumn("disposal_qty", "double precision", (col) => col.defaultTo(0))
    .addColumn("disposal_shipped_qty", "double precision", (col) =>
      col.defaultTo(0)
    )
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  // Create disposal_method_reasons table
  await db.schema
    .createTable("ws_disposal_method_reasons")
    .ifNotExists()
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("disposal_method_id", "integer", (col) =>
      col.notNull().unsigned()
    )
    .addColumn("transaction_reason_id", "bigint", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("disposal_method_reasons_disposal_method_id_index")
    .on("ws_disposal_method_reasons")
    .column("disposal_method_id")
    .execute()

  await db.schema
    .createIndex("disposal_method_reasons_transaction_reason_id_index")
    .on("ws_disposal_method_reasons")
    .column("transaction_reason_id")
    .execute()

  // Create disposal_transactions table
  await db.schema
    .createTable("ws_disposal_transactions")
    .ifNotExists()
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("disposal_transaction_type_id", "integer", (col) =>
      col.notNull().unsigned()
    )
    .addColumn("disposal_method_id", "integer", (col) =>
      col.notNull().unsigned()
    )
    .addColumn("entity_id", "bigint", (col) => col.notNull())
    .addColumn("activity_id", "bigint", (col) => col.notNull())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("stock_disposal_id", "bigint", (col) => col.notNull().unsigned())
    .addColumn("opening_qty", "double precision", (col) => col.defaultTo(0))
    .addColumn("change_qty", "double precision", (col) => col.defaultTo(0))
    .addColumn("open_vial", "double precision", (col) => col.defaultTo(0))
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("disposal_transactions_disposal_transaction_type_id_index")
    .on("ws_disposal_transactions")
    .column("disposal_transaction_type_id")
    .execute()

  await db.schema
    .createIndex("disposal_transactions_disposal_method_id_index")
    .on("ws_disposal_transactions")
    .column("disposal_method_id")
    .execute()

  await db.schema
    .createIndex("disposal_transactions_activity_id_index")
    .on("ws_disposal_transactions")
    .column("activity_id")
    .execute()

  await db.schema
    .createIndex("disposal_transactions_entity_id_index")
    .on("ws_disposal_transactions")
    .column("entity_id")
    .execute()

  await db.schema
    .createIndex("disposal_transactions_material_id_index")
    .on("ws_disposal_transactions")
    .column("material_id")
    .execute()

  await db.schema
    .createIndex("disposal_transactions_stock_disposal_id_index")
    .on("ws_disposal_transactions")
    .column("stock_disposal_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_disposal_transactions").execute()
  await db.schema.dropTable("ws_disposal_method_reasons").execute()
  await db.schema.dropTable("ws_disposal_stocks").execute()
  await db.schema.dropTable("ws_disposal_methods").execute()
  await db.schema.dropTable("ws_disposal_transaction_types").execute()
}
