import type { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("mapping_stock_opnames")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("platform_stock_opname_id", "bigint", (col) => col.notNull())
    .addColumn("existing_stock_opname_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createIndex("idx_mapping_stock_opnames_platform_stock_opname_id")
    .on("mapping_stock_opnames")
    .column("platform_stock_opname_id")
    .column("program_id")
    .execute()

  await db.schema
    .createIndex("idx_mapping_stock_opnames_existing_stock_opname_id")
    .on("mapping_stock_opnames")
    .column("existing_stock_opname_id")
    .column("program_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("mapping_stock_opnames").execute()
}