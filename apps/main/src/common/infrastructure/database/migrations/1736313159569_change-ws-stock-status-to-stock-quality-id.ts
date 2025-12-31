import { type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // Rename column in ws_stock
  await db.schema
    .alterTable("ws_stocks")
    .renameColumn("status", "stock_quality_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Reverse the column rename
  await db.schema
    .alterTable("ws_stocks")
    .renameColumn("stock_quality_id", "status")
    .execute()
}
