import type { Kysely } from 'kysely'
import { addTimestampColumns } from "../helper.js"
import { Database } from '../types/index.js'

export async function up(db: Kysely<Database>): Promise<void> {
	// up migration code goes here...
	// note: up migrations are mandatory. you must implement this function.
	// For more info, see: https://kysely.dev/docs/migrations
		await db.schema
			.createTable(`mapping_event_reports`)
			.addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
			.addColumn("program_id", "bigint", (col) => col.notNull())
			.addColumn(`platform_event_report_id`, "bigint", (col) => col.notNull())
			.addColumn(`existing_event_report_id`, "bigint", (col) => col.notNull())
			.$call(addTimestampColumns)
			.execute()
	
		await db.schema
			.createIndex(`idx_mapping_event_reports_platform_event_report_id`)
			.on(`mapping_event_reports`)
			.column(`platform_event_report_id`)
			.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
	// down migration code goes here...
	// note: down migrations are optional. you can safely delete this function.
	// For more info, see: https://kysely.dev/docs/migrations
	await db.schema.dropTable("mapping_event_reports").execute()
}
