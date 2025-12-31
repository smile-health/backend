import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.createTable("ws_annual_need_results")
	.addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
	.addColumn("annual_need_id", "bigint", (col) => col.notNull())
	.addColumn("entity_id", "bigint", (col) => col.notNull())
	.addColumn("activity_id", "bigint", (col) => col.notNull())
	.addColumn("material_id", "bigint", (col) => col.notNull())
	.addColumn("ip", "double precision")
	.addColumn("yearly_need", "double precision")
	.addColumn("monthly_need", "double precision")
	.addColumn("weekly_need", "double precision")
	.addColumn("min", "bigint")
	.addColumn("max", "bigint")
	.addColumn("month_distribution", "text")
	.$call(addAuditColumns)
	.$call(addTimestampColumns)
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_annual_need_results").execute()
}
