import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("target_groups")
    .addColumn("id", "integer", (col) => col.autoIncrement().primaryKey())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("is_active", "boolean", (col) => col.defaultTo(true).notNull())
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("target_groups").execute()
}
