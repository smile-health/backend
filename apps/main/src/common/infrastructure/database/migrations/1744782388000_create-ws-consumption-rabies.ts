import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_consumption_rabies")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("consumption_id", "bigint", (col) => col.notNull())
    .addColumn("vaccine_type", "integer", (col) => col.notNull())
    .addColumn("vaccine_method", "integer", (col) => col.notNull())
    .addColumn("vaccine_sequence", "integer", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_consumption_rabies").execute()
}
