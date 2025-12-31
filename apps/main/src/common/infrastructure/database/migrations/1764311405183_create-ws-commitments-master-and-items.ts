import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_commitments")
    .ifNotExists()
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "bigint", (col) => col.notNull())
    .addColumn("contract_id", "bigint", (col) => col.notNull())
    .addColumn("vendor_id", "bigint", (col) => col.notNull())
    .addColumn("year", "integer", (col) => col.notNull())
    .addColumn("contract_start_date", "datetime", (col) => col.notNull())
    .addColumn("contract_end_date", "datetime")
    .addColumn("information", "text")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createTable("ws_commitment_items")
    .ifNotExists()
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("commitment_id", "bigint", (col) => col.notNull())
    .addColumn("delivery_type_id", "bigint", (col) => col.notNull())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("parent_material_id", "bigint")
    .addColumn("province_id", "bigint")
    .addColumn("vial_quantity", "integer", (col) => col.notNull())
    .addColumn("dose_quantity", "integer", (col) => col.notNull())
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_commitment_items").execute()
  await db.schema.dropTable("ws_commitments").execute()
}
