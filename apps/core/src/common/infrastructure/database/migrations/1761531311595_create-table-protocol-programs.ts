import type { Kysely } from 'kysely'
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("protocol_programs")
		.addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
		.addColumn("protocol_id", "bigint", (col)=> col.notNull())
		.addColumn("program_id", "bigint", (col)=> col.notNull())
		.addColumn("created_by", "bigint")
		.addColumn("updated_by", "bigint")
		.addColumn("deleted_by", "bigint")
		.$call(addTimestampColumns)
		.execute()	
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("protocol_programs").execute()
}
