import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_stock_consumptions")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("vendor_stock_id", "bigint", (col) => col.notNull())
    .addColumn("batch_id", "bigint")
    .addColumn("qty", "double precision", (col) => col.notNull().unsigned())
    .addColumn("vendor_id", "bigint", (col) => col.notNull())
    .addColumn("customer_id", "bigint", (col) => col.notNull())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("activity_id", "bigint", (col) => col.notNull())
    .addColumn("vendor_stock_activity_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .alterTable("ws_stock_consumptions")
    .addUniqueConstraint("unique_vendor_stock", [
      "vendor_stock_id",
      "vendor_id",
      "customer_id",
      "activity_id",
    ])
    .execute()

  await db.schema
    .createIndex("ws_stock_consumptions_material_id_index")
    .on("ws_stock_consumptions")
    .column("material_id")
    .execute()

  await db.schema
    .createIndex("ws_stock_consumptions_activity_id_index")
    .on("ws_stock_consumptions")
    .column("activity_id")
    .execute()

  await db.schema
    .createIndex("ws_stock_consumptions_batch_id_index")
    .on("ws_stock_consumptions")
    .column("batch_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_stock_consumptions").execute()
}
