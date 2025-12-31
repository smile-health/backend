import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "ws_transaction_types"

export async function seed(db: Kysely<Database>): Promise<void> {
  /* Soft delete
   * ID 1 = Stock Count
   * ID 6 = Open Vial Acceptance
   */

  await db
    .updateTable(TABLE_NAME)
    .set({ deleted_at: new Date() })
    .where((eb) => eb.or([eb("id", "=", 1), eb("id", "=", 6)]))
    .execute()
}
