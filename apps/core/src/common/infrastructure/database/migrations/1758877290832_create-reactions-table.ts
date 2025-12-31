import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("reactions")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .$call((qb) => addTimestampColumns(qb))
    .$call((qb) => addAuditColumns(qb))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("reactions").execute()
}
