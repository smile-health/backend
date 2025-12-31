import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_orders")
    .addColumn("order_cancel_reason_id", "integer")
    .execute()

  await db.schema
    .alterTable("ws_order_item_stocks")
    .dropColumn("cancel_reason_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_orders")
    .dropColumn("order_cancel_reason_id")
    .execute()

  await db.schema
    .alterTable("ws_order_item_stocks")
    .addColumn("cancel_reason_id", "integer")
    .execute()
}
