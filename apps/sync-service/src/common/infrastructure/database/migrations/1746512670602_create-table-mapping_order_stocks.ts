import type { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable(`mapping_order_stocks`)
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn(`platform_order_item_stock_id`, "bigint", (col) => col.notNull())
    .addColumn(`platform_stock_id`, "bigint", (col) => col.notNull())
    .addColumn(`existing_order_stock_id`, "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex(`idx_mapping_order_stocks_platform_order_item_stock_id`)
    .on(`mapping_order_stocks`)
    .column(`platform_order_item_stock_id`)
    .column(`platform_stock_id`)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_order_stocks").execute()
}
