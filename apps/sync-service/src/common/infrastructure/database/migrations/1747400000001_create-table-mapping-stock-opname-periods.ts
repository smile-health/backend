import type { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("mapping_stock_opname_periods")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_stock_opname_period_id", "bigint", (col) => col.notNull())
    .addColumn("existing_stock_opname_period_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_stock_opname_periods_platform_period_id")
    .on("mapping_stock_opname_periods")
    .column("platform_stock_opname_period_id")
    .column("program_id")
    .execute()

  await db.schema
    .createIndex("idx_mapping_stock_opname_periods_existing_period_id")
    .on("mapping_stock_opname_periods")
    .column("existing_stock_opname_period_id")
    .column("program_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_stock_opname_periods").execute()
}