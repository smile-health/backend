import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .alterTable("ws_order_reasons")
    .addColumn("order_type", "varchar(50)")
    .execute()

  await db
    .updateTable("ws_order_reasons")
    .set({ order_type: "request" })
    .where("order_type", "is", null)
    .where("id", "!=", 9)
    .execute()

  await db
    .insertInto("ws_order_reasons")
    .values({
      name: "referral_back",
      order_type: "relocation",
    })
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  // Hapus kolom
  await db.schema
    .alterTable("ws_order_reasons")
    .dropColumn("order_type")
    .execute()
}
