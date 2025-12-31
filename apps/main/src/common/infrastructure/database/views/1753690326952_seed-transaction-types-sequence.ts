import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "ws_transaction_types"

export async function seed(db: Kysely<Database>): Promise<void> {
  const list = await db.selectFrom(TABLE_NAME).selectAll().execute()

  const sequenceMap = {
    7: 1, // Add Stock
    8: 2, // Remove Stock
    10: 3, // Consumption
    5: 4, // Return of Heatlh Facilities
    4: 5, // Discard
    9: 6, // Cancellation of Discard
    11: 7, // Transfer Stock
  }

  const newList = list.map((item) => ({
    ...item,
    sequence: sequenceMap[item.id] ?? item.sequence,
  }))

  for (const item of newList) {
    await db
      .updateTable(TABLE_NAME)
      .set(item)
      .where("id", "=", item.id)
      .execute()
  }
}
