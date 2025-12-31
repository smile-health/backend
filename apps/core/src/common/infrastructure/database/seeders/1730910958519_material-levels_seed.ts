import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const materialLevels = [
    { name: "ingredient", order: 1 },
    { name: "template", order: 2 },
    { name: "variant", order: 3 },
    { name: "packaging", order: 4 },
  ]

  const existingEntries = await db
    .selectFrom("material_levels")
    .select(["id", "name", "order"])
    .where(
      "name",
      "in",
      materialLevels.map((materialLevel) => materialLevel.name)
    )
    .execute()

  const existingKeys = new Set(existingEntries.map((entry) => entry.name))

  const updates = existingEntries.map((entry) => ({
    id: entry.id,
    ...materialLevels.find(
      (materialLevel) => materialLevel.name === entry.name
    ),
  }))

  const inserts = materialLevels.filter(
    (materialLevel) => !existingKeys.has(materialLevel.name)
  )

  for (const update of updates) {
    await db
      .updateTable("material_levels")
      .set(update)
      .where("id", "=", update.id)
      .execute()
  }

  if (inserts.length > 0) {
    await db.insertInto("material_levels").values(inserts).execute()
  }
}
