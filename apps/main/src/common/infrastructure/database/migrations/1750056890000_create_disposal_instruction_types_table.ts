import type { Kysely } from "kysely"
import type { Database } from "../types/index.js"
import { addAuditColumns, addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_disposal_instruction_types")
    .ifNotExists()
    .addColumn("id", "integer", (col) =>
      col.autoIncrement().primaryKey().unsigned()
    )
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_disposal_instruction_types").execute()
}