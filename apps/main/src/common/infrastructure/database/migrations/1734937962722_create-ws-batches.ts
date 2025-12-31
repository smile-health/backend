import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_batches")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("manufacture_id", "bigint", (col) => col.notNull())
    .addColumn("code", "varchar(255)", (col) => col.notNull())
    .addColumn("production_date", "datetime")
    .addColumn("expired_date", "datetime")
    .addColumn("status", "boolean", (col) => col.defaultTo(true))
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_batches").execute()
}
