import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_plan_target_group")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_plan_id", "bigint", (col) => col.notNull())
    .addColumn("target_group_id", "bigint", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_plan_target_group").execute()
}
