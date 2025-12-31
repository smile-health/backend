import { Kysely } from "kysely"
import { Database } from "../types/index.js"

const TABLE_NAME = "rabies_vaccine_types"

export async function seed(db: Kysely<Database>): Promise<void> {
  const vaccineTypes = [
    { id: 1, title: "Pra-Pajanan" },
    { id: 2, title: "Pasca-Pajanan" },
    { id: 3, title: "Booster" },
  ]

  const existingRecords = await db
    .selectFrom(TABLE_NAME)
    .select(["id", "title"])
    .where(
      "id",
      "in",
      vaccineTypes.map((type) => type.id)
    )
    .execute()

  const existingIds = new Set(existingRecords.map((entry) => entry.id))

  const updates = existingRecords.map((entry) => ({
    id: entry.id,
    ...vaccineTypes.find((type) => type.id === entry.id),
  }))

  const inserts = vaccineTypes.filter((type) => !existingIds.has(type.id))

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
