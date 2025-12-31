import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const stockQualities = [
    { id: 1, label: "VVM A" },
    { id: 2, label: "VVM B" },
    { id: 3, label: "VVM C" },
    { id: 4, label: "VVM D" },
  ]

  await db.insertInto("ws_stock_qualities").values(stockQualities).execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`truncate table ws_stock_qualities`.execute(db)
}
