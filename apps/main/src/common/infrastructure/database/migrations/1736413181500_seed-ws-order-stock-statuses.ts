import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const deliveryTypes = ["vvma", "vvmb", "vvmc", "vvmd"]

  await db
    .insertInto("ws_order_stock_statuses")
    .values(
      deliveryTypes.map((name) => ({
        name: name,
      }))
    )
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`truncate table ws_order_stock_statuses`.execute(db)
}
