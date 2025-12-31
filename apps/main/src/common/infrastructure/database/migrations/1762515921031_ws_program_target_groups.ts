import { Kysely, sql } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_program_target_groups")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("target_group_id", "bigint", (col) => col.notNull())
    .addColumn("year", sql`year`, (col) => col.notNull())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_program_target_groups").execute()
}
