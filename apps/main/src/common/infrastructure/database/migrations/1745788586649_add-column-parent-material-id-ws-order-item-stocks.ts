import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_order_item_stocks")
    .addColumn("parent_material_id", "integer")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_order_item_stocks")
    .dropColumn("parent_material_id")
    .execute()
}
