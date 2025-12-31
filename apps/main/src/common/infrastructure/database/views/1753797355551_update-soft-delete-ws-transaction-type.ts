import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "ws_transaction_types"

export async function seed(db: Kysely<Database>): Promise<void> {
  /* Update enable transaction type "Issue" and "Receive"
   * ID 2 = Issue
   * ID 3 = Receive
   */

  await db
    .updateTable(TABLE_NAME)
    .set({ deleted_at: null })
    .where((eb) => eb.or([eb("id", "=", 2), eb("id", "=", 3)]))
    .execute()
}
