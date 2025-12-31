import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "ws_transaction_types"

export async function seed(db: Kysely<Database>): Promise<void> {
  await db
    .updateTable(TABLE_NAME)
    .set({ deleted_at: new Date() })
    .where((eb) => eb.or([eb("enable", "=", 0), eb("enable", "is", null)]))
    .execute()
}
