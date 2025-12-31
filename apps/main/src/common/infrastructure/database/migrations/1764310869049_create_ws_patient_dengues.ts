import type { Kysely } from "kysely"
import { DB } from "../types/db.js"
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<DB>): Promise<void> {
	await db.schema
    .createTable("ws_patient_dengues")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("patient_id", "bigint")
    .addColumn("input_date", "datetime")
    .addColumn("clinical_diagnosis_id", "bigint")
    .addColumn("symptoms_id", "varchar(255)")
    .addColumn("last_status_id", "bigint")
    .addColumn("epidemiology_type", "integer")
    .addColumn("pe_result_id", "bigint")
    .addColumn("vector_control_id", "varchar(255)")
    .addColumn("laboratory_examination", "integer")
    .addColumn("examination_type", "varchar(255)")
		.addColumn("laboratory_id", "bigint")
		.addColumn("laboratory_name", "varchar(255)")
    .addColumn("entity_id", "bigint")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
	await db.schema.dropTable("ws_patient_dengues").execute()
}
