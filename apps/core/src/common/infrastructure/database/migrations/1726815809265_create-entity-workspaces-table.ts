import { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("entity_workspaces")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("entity_id", "bigint")
    .addColumn("workspace_id", "bigint")
    .addColumn("status", "boolean", (col) => col.defaultTo(true))
    .addColumn("is_vendor", "boolean", (col) => col.defaultTo(false))
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("entity_workspaces").execute()
}
