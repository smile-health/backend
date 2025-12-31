import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("dashboard_configs")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("key", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("config", "text")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("dashboard_configs").execute()
}
