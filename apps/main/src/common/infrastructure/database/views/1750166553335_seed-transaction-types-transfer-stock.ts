import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "ws_transaction_types"

export async function seed(db: Kysely<Database>): Promise<void> {
  const transactionType = [
    {
      id: 11,
      title: "Transfer Stok",
      title_en: "Transfer Stock",
      change_type: 4,
      enable: 1,
    },
  ]

  const existingRecords = await db
    .selectFrom(TABLE_NAME)
    .select(["id"])
    .execute()

  const existingIds = new Set(existingRecords.map((entry) => entry.id))
  const inserts = transactionType.filter((item) => !existingIds.has(item.id))

  if (inserts.length > 0) {
    await db.insertInto(TABLE_NAME).values(inserts).execute()
  }
}
