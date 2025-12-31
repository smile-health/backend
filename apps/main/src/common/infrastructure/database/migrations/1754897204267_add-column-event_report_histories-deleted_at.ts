import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_event_report_histories")
    .addColumn("deleted_at", "timestamp")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_event_report_histories")
    .dropColumn("deleted_at")
    .execute()
}
