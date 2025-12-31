import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_coverage")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("amount_of_giving_id", "bigint", (col) => col.notNull())
    .addColumn("province_id", "bigint", (col) => col.notNull())
    .addColumn("coverage_number", "bigint", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_coverage").execute()
}
