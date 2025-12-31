import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_transactions")
    .addColumn("status", "integer")
    .addColumn("transaction_companion", "bigint")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_transactions")
    .dropColumn("status")
    .dropColumn("transaction_companion")
    .execute()
}
