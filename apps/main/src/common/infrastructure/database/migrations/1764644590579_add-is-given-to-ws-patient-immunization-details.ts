import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_patient_immunization_details")
    .addColumn("is_given", "int2")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_patient_immunization_details")
    .dropColumn("is_given")
    .execute()
}
