import { Kysely, sql } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper"
import { Database } from "../types"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("populations")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("target_group_id", "bigint", (col) => col.notNull())
    .addColumn("year", sql`year`, (col) => col.notNull())
    .addColumn("entity_id", "bigint", (col) => col.notNull())
    .addColumn("population_number", "bigint", (col) => col.notNull())
    .$call((qb) => addAuditColumns(qb))
    .$call((qb) => addTimestampColumns(qb))
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("populations").execute()
}
