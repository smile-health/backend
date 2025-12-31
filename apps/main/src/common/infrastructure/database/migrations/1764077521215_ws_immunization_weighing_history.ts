import { sql, type Kysely } from "kysely"
import { DB } from "../types/db.js"
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("ws_immunization_weighing_history")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("patient_immunization_id", "bigint", (col) => col.notNull())
    .addColumn("input_date", "date")
    .addColumn("gender", "integer")
    .addColumn("weight", "decimal")
    .addColumn("height", "decimal")
    .addColumn("z_score_weight", "decimal")
    .addColumn("z_score_height", "decimal")
    .addColumn("z_score_bmi", "decimal")
    .addColumn("status", "int2", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("ws_immunization_weighing_history_patient_immunization_id_idx")
    .on("ws_immunization_weighing_history")
    .column("patient_immunization_id")
    .execute()

  await db.schema
    .createIndex("ws_immunization_weighing_history_input_date_idx")
    .on("ws_immunization_weighing_history")
    .column("input_date")
    .execute()

  await db.schema
    .alterTable("ws_immunization_weighing_history")
    .addForeignKeyConstraint(
      "ws_immunization_weighing_history_patient_immunization_id_fk",
      ["patient_immunization_id"],
      "ws_patient_immunizations",
      ["id"]
    )
    .onDelete("cascade")
    .execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("ws_immunization_weighing_history").execute()
}
