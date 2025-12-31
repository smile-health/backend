import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const manufactureTypes = [
    { name: "Vaksin" },
    { name: "Kulkas" },
    { name: "Logger" },
  ]

  const existingRecords = await db
    .selectFrom("manufacture_types")
    .select(["id", "name"])
    .where(
      "name",
      "in",
      manufactureTypes.map((type) => type.name)
    )
    .execute()

  const existingValues = new Set(existingRecords.map((entry) => entry.name))

  const updates = existingRecords.map((entry) => ({
    id: entry.id,
    ...manufactureTypes.find((type) => type.name === entry.name),
  }))

  const inserts = manufactureTypes.filter(
    (type) => !existingValues.has(type.name)
  )

  for (const update of updates) {
    await db
      .updateTable("manufacture_types")
      .set(update)
      .where("id", "=", update.id)
      .execute()
  }

  if (inserts.length > 0) {
    await db.insertInto("manufacture_types").values(inserts).execute()
  }
}
