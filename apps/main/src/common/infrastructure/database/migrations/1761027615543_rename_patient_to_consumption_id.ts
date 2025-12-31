import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_stop_notification_histories")
    .renameColumn("patient_id", "consumption_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_stop_notification_histories")
    .renameColumn("consumption_id", "patient_id")
    .execute()
}
