import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_patient_medical_histories")
    .addColumn("id", "bigint", (col) => col.primaryKey())
    .addColumn("patient_id", "bigint", (col) => col.notNull())
    .addColumn("protocol_id", "bigint", (col) => col.notNull())
    .addColumn("is_diagnose_before", "boolean", (col) => col.defaultTo(false))
    .addColumn("diagnosis_date", "date")
    .addColumn("month_before", "smallint")
    .addColumn("year_before", "smallint")
    .addColumn("received_medicine", "boolean")
    .addColumn("received_vaccine", "boolean")
    .addColumn("notes", "text")
    .$call((qb) => addTimestampColumns(qb))
    .$call((qb) => addAuditColumns(qb))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_patient_medical_histories").execute()
}
