import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("integration_ws_orders")
    .addColumn("customer_id", "integer", (col) => col.notNull())
    .addColumn("vendor_id", "integer", (col) => col.notNull())
    .addColumn("smile_platform_order_id", "bigint", (col) => col.notNull())
    .addColumn("status", "smallint")
    .addColumn("activity_id", "varchar(50)")
    .addColumn("key_ssl", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("total_patients", "integer")
    .addColumn("system_source", "varchar(255)")
    .addColumn("no_surat", "varchar(255)")
    .addColumn("is_validate", "smallint")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("integration_ws_orders").execute()
}
