import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_material_ratios")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_plan_id", "bigint", (col) => col.notNull())
    .addColumn("from_material_id", "varchar(100)", (col) => col.notNull())
    .addColumn("from_material_qty", "int4", (col) => col.notNull())
    .addColumn("to_material_id", "varchar(100)", (col) => col.notNull())
    .addColumn("to_material_qty", "int4", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_material_ratios").execute()
}
