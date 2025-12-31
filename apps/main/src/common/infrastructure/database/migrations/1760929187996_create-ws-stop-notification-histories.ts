import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_stop_notification_histories")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("patient_id", "bigint", (col) => col.notNull())
    .addColumn("reason_id", "integer", (col) => col.notNull())
    .addColumn("status", "integer", (col) => col.defaultTo(1))
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_stop_notification_histories").execute()
}
