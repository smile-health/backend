import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("plan_approaches")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .$call((qb) => addAuditColumns(qb))
    .$call((qb) => addTimestampColumns(qb))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("plan_approaches").execute()
}
