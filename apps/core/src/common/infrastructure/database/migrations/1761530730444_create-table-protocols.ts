import type { Kysely } from 'kysely'
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("protocols")
		.addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
		.addColumn("name", "varchar(255)", (col) => col.notNull())
		.addColumn("created_by", "bigint")
		.addColumn("updated_by", "bigint")
		.addColumn("deleted_by", "bigint")
		.addColumn("status", "smallint", (col) => col.defaultTo(1))
		.addColumn("is_kipi", "smallint", (col)=> col.defaultTo(0))
		.addColumn("is_medical_history", "smallint", (col)=> col.defaultTo(0))
		.addColumn("is_identity_type", "smallint", (col)=> col.defaultTo(0))
		.$call(addTimestampColumns)
		.execute()	
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("protocols").execute()
}
