import type { Kysely } from 'kysely'
import { DB } from '../types/db.js'
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<DB>): Promise<void> {
	await db.schema
		.createTable("examination_method")
		.addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
		.addColumn("name", "varchar(255)")
		.$call(addAuditColumns)
		.$call(addTimestampColumns)
		.execute()
}

export async function down(db: Kysely<DB>): Promise<void> {
	await db.schema.dropTable("examination_method").execute()
}
