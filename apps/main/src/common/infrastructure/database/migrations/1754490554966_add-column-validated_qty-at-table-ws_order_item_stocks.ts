import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_order_item_stocks")
    .addColumn("validated_qty", "double precision")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_order_item_stocks")
    .dropColumn("validated_qty")
    .execute()
}
