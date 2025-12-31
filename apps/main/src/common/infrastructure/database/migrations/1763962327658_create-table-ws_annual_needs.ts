import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.createTable("ws_annual_needs")
	.addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
	.addColumn("province_id", "bigint", (col) => col.notNull())
	.addColumn("regency_id", "bigint", (col) => col.notNull())
	.addColumn("entity_id", "bigint", (col) => col.notNull())
	.addColumn("program_plan_id", "bigint", (col) => col.notNull())
	.addColumn("status", "varchar(255)", (col)=> col.defaultTo("Draft"))
	.addColumn("min_max_status", "varchar(255)")
	.addColumn("min_max_updated_at", "datetime")
	.$call(addAuditColumns)
	.$call(addTimestampColumns)
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_annual_needs").execute()
}
