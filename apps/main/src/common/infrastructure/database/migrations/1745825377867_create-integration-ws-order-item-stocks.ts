import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("integration_ws_order_item_stocks")
    .addColumn("integration_ws_order_id", "bigint", (col) => col.notNull())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("parent_material_id", "bigint")
    .addColumn("product_code", "varchar(255)")
    .addColumn("qty", "double precision")
    .addColumn("recommended_stock", "double precision")
    .addColumn("confirmed_qty", "double precision")
    .addColumn("reason_id", "integer")
    .addColumn("other_reason", "varchar(255)")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("integration_ws_order_item_stocks").execute()
}
