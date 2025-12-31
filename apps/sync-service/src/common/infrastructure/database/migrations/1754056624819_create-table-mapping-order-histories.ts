import type { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable(`mapping_order_histories`)
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn(`platform_order_history_id`, "bigint", (col) => col.notNull())
    .addColumn(`existing_order_history_id`, "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex(`idx_mapping_order_history_platform_order_history_id`)
    .on(`mapping_order_histories`)
    .column(`platform_order_history_id`)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_order_histories").execute()
}
