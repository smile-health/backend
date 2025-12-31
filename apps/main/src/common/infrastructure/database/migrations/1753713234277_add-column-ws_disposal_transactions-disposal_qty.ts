import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    ALTER TABLE ws_disposal_transactions 
    ADD COLUMN disposal_discard_qty DOUBLE AFTER change_qty,
    ADD COLUMN disposal_received_qty DOUBLE AFTER disposal_discard_qty
  `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_disposal_transactions")
    .dropColumn("disposal_discard_qty")
    .dropColumn("disposal_received_qty")
    .execute()
}
