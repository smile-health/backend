import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_transactions")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("activity_id", "bigint")
    .addColumn("entity_activity_id", "bigint")
    .addColumn("opening_qty", "double precision", (col) => col.defaultTo(0))
    .addColumn("change_qty", "double precision", (col) => col.defaultTo(0))
    .addColumn("transaction_type_id", "bigint")
    .addColumn("transaction_reason_id", "bigint")
    .addColumn("entity_id", "bigint")
    .addColumn("companion_entity_id", "bigint")
    .addColumn("stock_id", "bigint")
    .addColumn("order_id", "bigint")
    .addColumn("batch_code", "varchar(255)")
    .addColumn("device_type", "smallint")
    .addColumn("commit_datetime", "datetime")
    .addColumn("actual_transaction_date", "datetime")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_purchases")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("transaction_id", "bigint")
    .addColumn("source_id", "bigint")
    .addColumn("source_type", "varchar(255)")
    .addColumn("budget_source_id", "bigint")
    .addColumn("year", "integer")
    .addColumn("price", "double precision")
    .addColumn("total_price", "double precision")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_transaction_reasons")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "integer", (col) => col.notNull())
    .addColumn("title", "varchar(255)")
    .addColumn("title_en", "varchar(255)")
    .addColumn("transaction_type_id", "integer")
    .addColumn("is_other", "boolean")
    .addColumn("is_purchase", "boolean")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_transaction_types")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("title", "varchar(255)")
    .addColumn("title_en", "varchar(255)")
    .addColumn("change_type", "varchar(50)")
    .addColumn("enable", "integer")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await Promise.allSettled([
    db.schema.dropTable("ws_transactions").execute(),
    db.schema.dropTable("ws_purchases").execute(),
    db.schema.dropTable("ws_transaction_reasons").execute(),
    db.schema.dropTable("ws_transaction_types").execute(),
  ])
}
