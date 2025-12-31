import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const orderTypes = [
    { name: "request" },
    { name: "distribution" },
    { name: "return" },
    { name: "central_distribution" }, // change for central distribution after diskusi with pak kepsek == pak awah
    { name: "extermination" },
    { name: "independent_extermination" },
  ]

  await db.insertInto("ws_order_types").values(orderTypes).execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`truncate table ws_order_types`.execute(db)
}
