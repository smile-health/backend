import type { Kysely } from "kysely"
import { DB } from "../types/db.js"
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<DB>): Promise<void> {
	await db.schema
    .createTable("ws_specimens")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("patient_id", "bigint")
    .addColumn("patient_dengue_id", "bigint")
    .addColumn("specimen_type_id", "bigint")
    .addColumn("specimen_code", "varchar(255)")
    .addColumn("collection_date", "date")
    .addColumn("release_date", "date")
    .addColumn("examination_method_id", "bigint")
    .addColumn("equipment_id", "bigint")
    .addColumn("reagent_id", "bigint")
    .addColumn("examination_result_id", "bigint")
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
	await db.schema.dropTable("ws_specimens").execute()
}
