import { type Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.createTable("ws_annual_need_min_max_status")
	.addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
	.addColumn("program_plan_id", "bigint", (col) => col.notNull())
	.addColumn("province_id", "bigint", (col) => col.notNull())
	.addColumn("entity_id", "bigint", (col) => col.notNull())
	.addColumn("regency_activated_at", "datetime")
	.addColumn("province_activated_at", "datetime")
	.$call(addAuditColumns)
	.$call(addTimestampColumns)
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_annual_need_min_max_status").execute()
}
