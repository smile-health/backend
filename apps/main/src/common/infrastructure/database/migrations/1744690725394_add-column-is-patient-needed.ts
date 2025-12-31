import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_material_activities")
    .addColumn("is_patient_needed", "boolean", (col) => col.defaultTo(false))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_material_activities")
    .dropColumn("is_patient_needed")
    .execute()
}
