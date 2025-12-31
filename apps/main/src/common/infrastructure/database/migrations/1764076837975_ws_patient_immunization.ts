import type { Kysely } from 'kysely'
import { DB } from '../types/db.js';
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<DB>): Promise<void> {
	await db.schema
		.createTable('ws_patient_immunizations')
		.addColumn('id', 'bigint', (col) => col.autoIncrement().primaryKey())
		.addColumn('patient_id', 'bigint')
		.addColumn('parent_name', 'varchar(255)')
		.$call(addAuditColumns)
		.$call(addTimestampColumns)
		.execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
	await db.schema.dropTable("ws_patient_immunizations").execute()
}
