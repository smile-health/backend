import { Kysely, sql } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
        ALTER TABLE ws_transactions
        ADD COLUMN opening_qty_open_vial DOUBLE DEFAULT 0 AFTER returned_qty_open_vial;
      `.execute(db)
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_transactions")
    .dropColumn("opening_qty_open_vial")
    .execute()
}
