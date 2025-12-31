import type { Kysely } from 'kysely'
import { DB } from '../types/db.js';
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<DB>): Promise<void> {
	await db.schema
		.createTable("ws_sentinel_surveillance")
		.addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
		.addColumn("patient_id", "bigint")
		.addColumn("specimen_id", "bigint")
		.addColumn("duration", "integer")
		.addColumn("case_report_completed", "boolean", (col) => col.notNull().defaultTo(false))
		.addColumn("lab_result_id", "varchar(255)")
		.addColumn("entity_id", "bigint")
		.$call(addAuditColumns)
		.$call(addTimestampColumns)
		.execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
	await db.schema.dropTable("ws_sentinel_surveillance").execute()
}
