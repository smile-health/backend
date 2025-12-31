import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "ws_disposal_transaction_types"

export async function seed(db: Kysely<Database>): Promise<void> {
  const transactionType = [
    {
      id: 1,
      title: "Pengiriman",
      created_by: null,
      updated_by: null,
      deleted_by: null,
    },
    {
      id: 2,
      title: "Penerimaan",
      created_by: null,
      updated_by: null,
      deleted_by: null,
    },
    {
      id: 3,
      title: "Pemusnahan Mandiri",
      created_by: null,
      updated_by: null,
      deleted_by: null,
    },
    {
      id: 4,
      title: "Instruksi Disposal",
      created_by: null,
      updated_by: null,
      deleted_by: null,
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
