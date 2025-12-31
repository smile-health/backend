import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_other_reasons")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("source_id", "bigint")
    .addColumn("source_type", "varchar(255)")
    .addColumn("content", "text")
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_other_reasons").execute()
}
