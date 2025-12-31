import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_patient_immunization_details")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("patient_immunization_id", "bigint", (col) => col.notNull())
    .addColumn("material_target_id", "bigint", (col) => col.notNull())
    .addColumn("batch_id", "bigint")
    .addColumn("ideal_schedule_date", "date")
    .addColumn("injection_date", "date")
    .addColumn("status", "integer")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("patient_immunization_id_idx")
    .on("ws_patient_immunization_details")
    .column("patient_immunization_id")
    .execute()

  await db.schema
    .createIndex("material_target_id_idx")
    .on("ws_patient_immunization_details")
    .column("material_target_id")
    .execute()

  await db.schema
    .createIndex("batch_id_idx")
    .on("ws_patient_immunization_details")
    .column("batch_id")
    .execute()

  await db.schema
    .alterTable("ws_patient_immunization_details")
    .addForeignKeyConstraint(
      "ws_patient_immunization_details_patient_immunization_id_fk",
      ["patient_immunization_id"],
      "ws_patient_immunizations",
      ["id"]
    )
    .onDelete("cascade")
    .execute()

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

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_patient_immunization_details").execute()
}
