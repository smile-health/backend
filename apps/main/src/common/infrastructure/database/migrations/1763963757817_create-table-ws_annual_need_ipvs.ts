import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.createTable("ws_annual_need_ipvs")
	.addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
	.addColumn("annual_need_id", "bigint", (col) => col.notNull())
	.addColumn("material_id", "bigint", (col) => col.notNull())
	.addColumn("activity_id", "bigint", (col) => col.notNull())
	.addColumn("sku", "double precision")
	.addColumn("national_ip", "double precision")
	.addColumn("regency_ip", "double precision")
	.$call(addAuditColumns)
	.$call(addTimestampColumns)
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_annual_need_ipvs").execute()
}
