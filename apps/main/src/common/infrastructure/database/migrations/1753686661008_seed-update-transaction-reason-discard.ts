import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_transaction_reasons")
    .addColumn("status", "boolean", (col) => col.notNull().defaultTo(true))
    .execute()

  // update data in ws_transaction_reasons
  await db
    .updateTable("ws_transaction_reasons")
    .set({ status: false })
    .where("id", "in", [9, 10, 11])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_transaction_reasons")
    .dropColumn("status")
    .execute()
}
