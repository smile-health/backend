import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
	.createTable("ws_annual_need_populations")
	.addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
	.addColumn("annual_need_id", "bigint", (col) => col.notNull())
	.addColumn("entity_id", "bigint", (col) => col.notNull())
	.addColumn("target_group_id", "bigint", (col) => col.notNull())
	.addColumn("percentage", "double precision", (col)=> col.defaultTo(0))
	.addColumn("population", "bigint", (col)=> col.defaultTo(0))
	.addColumn("population_correction", "bigint", (col)=> col.defaultTo(0))
	.$call(addAuditColumns)
	.$call(addTimestampColumns)
	.execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_annual_need_populations").execute()
}
