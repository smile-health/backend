import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_consumption_reactions")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("consumption_id", "bigint", (col) => col.notNull())
    .addColumn("reaction_id", "bigint", (col) => col.notNull())
    .addColumn("other_reaction", "varchar(255)")
    .addColumn("actual_date", "datetime")
    .$call((qb) => addTimestampColumns(qb))
    .$call((qb) => addAuditColumns(qb))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_consumption_reactions").execute()
}
