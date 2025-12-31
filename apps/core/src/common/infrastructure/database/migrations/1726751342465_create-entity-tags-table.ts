import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("entity_tags")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("title", "varchar(255)")
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("entity_tags").execute()
}
