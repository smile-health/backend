import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_patient_immunization_details")
    .dropConstraint("ws_patient_immunization_details_material_target_id_fk")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_patient_immunization_details")
    .addForeignKeyConstraint(
      "ws_patient_immunization_details_material_target_id_fk",
      ["material_target_id"],
      "ws_material_targets",
      ["id"]
    )
    .onDelete("cascade")
    .execute()
}
