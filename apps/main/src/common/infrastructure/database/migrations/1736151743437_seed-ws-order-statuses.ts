import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const orderStatuses = [
    { name: "pending" },
    { name: "confirmed" },
    { name: "allocated" },
    { name: "shipped" },
    { name: "fulfilled" },
    { name: "canceled" },
    { name: "independent_extermination" },
    { name: "draft" },
  ]

  await db.insertInto("ws_order_statuses").values(orderStatuses).execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`truncate table ws_order_statuses`.execute(db)
}
