import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const materialTypes = [
    { name: "medicine" },
    { name: "vaccine" },
    { name: "non_medical_devices" },
    { name: "medical_devices" },
    { name: "other_equipment" },
  ]

  const existingEntries = await db
    .selectFrom("material_types")
    .select(["id", "name"])
    .where(
      "name",
      "in",
      materialTypes.map((materialType) => materialType.name)
    )
    .execute()

  const existingKeys = new Set(existingEntries.map((entry) => entry.name))

  const updates = existingEntries.map((entry) => ({
    id: entry.id,
    ...materialTypes.find((materialType) => materialType.name === entry.name),
  }))

  const inserts = materialTypes.filter(
    (materialType) => !existingKeys.has(materialType.name)
  )

  for (const update of updates) {
    await db
      .updateTable("material_types")
      .set(update)
      .where("id", "=", update.id)
      .execute()
  }

  if (inserts.length > 0) {
    await db.insertInto("material_types").values(inserts).execute()
  }
}
