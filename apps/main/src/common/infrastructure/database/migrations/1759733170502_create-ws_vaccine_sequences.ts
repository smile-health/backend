import { sql, Kysely } from 'kysely'
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("vaccine_types")
		.addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
		.addColumn("title", "varchar(255)", (col) => col.notNull())
		.$call(addTimestampColumns)
		.execute()

	await db.schema
		.createTable("vaccine_methods")
		.addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
		.addColumn("title", "varchar(255)", (col) => col.notNull())
		.$call(addTimestampColumns)
		.execute()

	await sql`DROP TABLE IF EXISTS ws_vaccine_sequences`.execute(db) //drop old table if exists

	await db.schema
		.createTable("ws_vaccine_sequences")
		.addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
		.addColumn("title", "varchar(255)", (col) => col.notNull())
		.addColumn("protocol_id", "bigint", (col) => col.notNull())
		.addColumn("type_id", "integer")
		.addColumn("method_id", "integer")
		.addColumn("min", "integer")
		.addColumn("max", "integer")
		.addColumn("active_duration", "integer")
		.addColumn("start_notification", "integer")
		.addColumn("end_notification", "integer")
		.addColumn("restrict_duration", "integer") //[note: 'duration restriction in days']
		.addColumn("max_age", "integer") //max_age int [note: 'maximum age in days']
		.addColumn("ideal_age", "integer") //ideal_age int [note: 'ideal age in days']
		.addColumn("sort", "integer")
		.$call(addTimestampColumns)
		.execute()	
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("vaccine_types").execute()
	await db.schema.dropTable("vaccine_methods").execute()
	await db.schema.dropTable("ws_vaccine_sequences").execute()
}
