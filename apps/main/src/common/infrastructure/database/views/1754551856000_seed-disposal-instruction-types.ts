import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "ws_disposal_instruction_types"

export async function seed(db: Kysely<Database>): Promise<void> {
  const instructionTypes = [
    {
      id: 1,
      title: "Diserahkan Ke Unit Kesling",
      created_by: null,
      updated_by: null,
      deleted_by: null,
    },
    {
      id: 2,
      title: "Uji Bpom/Kemenkes",
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
  const inserts = instructionTypes.filter((item) => !existingIds.has(item.id))

  if (inserts.length > 0) {
    await db.insertInto(TABLE_NAME).values(inserts).execute()
  }
}
