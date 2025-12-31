import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "rabies_vaccine_methods"

export async function seed(db: Kysely<Database>): Promise<void> {
  const vaccineMethods = [
    { id: 1, title: "Intra Muskular", is_multi_patient: false },
    { id: 2, title: "Intra Dermal", is_multi_patient: true },
  ]

  const existingRecords = await db
    .selectFrom(TABLE_NAME)
    .select(["id", "title", "is_multi_patient"])
    .where(
      "id",
      "in",
      vaccineMethods.map((method) => method.id)
    )
    .execute()

  const existingIds = new Set(existingRecords.map((entry) => entry.id))

  const updates = existingRecords.map((entry) => ({
    id: entry.id,
    ...vaccineMethods.find((method) => method.id === entry.id),
  }))

  const inserts = vaccineMethods.filter((method) => !existingIds.has(method.id))

  for (const update of updates) {
    await db
      .updateTable(TABLE_NAME)
      .set(update)
      .where("id", "=", update.id)
      .execute()
  }

  if (inserts.length > 0) {
    await db.insertInto(TABLE_NAME).values(inserts).execute()
  }
}
