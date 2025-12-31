import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_patient_immunization_details")
    .addColumn("last_status", "integer")
    .addColumn("last_batch_id", "integer")
    .addColumn("last_injection_date", "date")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_patient_immunization_details")
    .dropColumn("last_status")
    .dropColumn("last_batch_id")
    .dropColumn("last_injection_date")
    .execute()
}
