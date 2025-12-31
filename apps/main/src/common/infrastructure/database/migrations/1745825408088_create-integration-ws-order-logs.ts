import type { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("integration_ws_order_logs")
    .addColumn("ws_order_id", "bigint", (col) => col.notNull())
    .addColumn("integration_order_id", "bigint", (col) => col.notNull())
    .addColumn("system_source", "varchar(255)")
    .addColumn("system_target", "varchar(50)")
    .addColumn("endpoint", "varchar(255)")
    .addColumn("http_method", "varchar(10)")
    .addColumn("action_type", "varchar(20)")
    .addColumn("request_body", "text")
    .addColumn("request_headers", "text")
    .addColumn("http_status_code", "integer")
    .addColumn("status", "varchar(20)")
    .addColumn("error_message", "text")
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("integration_ws_order_logs").execute()
}
