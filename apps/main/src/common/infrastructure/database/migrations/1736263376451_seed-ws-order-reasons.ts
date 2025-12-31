import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const orderReasons = [
    { id: -1, name: "empty" },
    { id: 1, name: "low_stock" },
    { id: 2, name: "population_growth" },
    { id: 3, name: "outbreak" },
    { id: 4, name: "sufficient_stock" },
    { id: 9, name: "others" },
  ]

  await db.insertInto("ws_order_reasons").values(orderReasons).execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`truncate table ws_order_reasons`.execute(db)
}
