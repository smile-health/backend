import { sql, type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const deliveryTypes = ["Reguler", "Buffer Provinsi", "Buffer Pusat"]

  await db
    .insertInto("ws_delivery_types")
    .values(
      deliveryTypes.map((name) => ({
        name: name,
      }))
    )
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`truncate table ws_delivery_types`.execute(db)
}
