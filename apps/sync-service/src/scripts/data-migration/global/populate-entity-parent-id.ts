import { db } from "@/scripts/db.platform.js"

const prefixes = ["RUANG FARMASI", "IGD", "LAB", "POLI HIV", "POLI TB"]
const suffix = "DALAM GEDUNG"

function cleanName(name: string): string {
  let cleaned = name.toUpperCase()

  // Remove prefix
  for (const p of prefixes) {
    if (cleaned.startsWith(p)) {
      cleaned = cleaned.substring(p.length)
      break
    }
  }

  // Remove suffix
  if (cleaned.endsWith(suffix)) {
    cleaned = cleaned.substring(0, cleaned.length - suffix.length)
  }

  // Trim spaces, dashes
  cleaned = cleaned
    .trim()
    .replace(/^-+|-+$/g, "")
    .trim()
  return cleaned
}

export async function populateEntityParentId() {
  try {
    // Query entities with names starting with any prefix and ending with suffix
    const entities = await db
      .selectFrom("entities")
      .select(["id", "name"])
      .where((eb) =>
        eb.or([
          eb("name", "like", "RUANG FARMASI%"),
          eb("name", "like", "IGD%"),
          eb("name", "like", "LAB%"),
          eb("name", "like", "POLI HIV%"),
          eb("name", "like", "POLI TB%"),
          eb("name", "like", "%Dalam Gedung"),
        ])
      )
      .where("parent_id", "is", null)
      .orderBy("id")
      .execute()

    console.log(
      `Found ${entities.length} entities matching prefixes and suffix.`
    )

    for (const entity of entities) {
      if (!entity.name) continue

      const cleanedName = cleanName(entity.name)
      if (!cleanedName) continue

      // Find entity with cleaned name
      const cleanedEntity = await db
        .selectFrom("entities")
        .select("id")
        .where("name", "=", cleanedName)
        .executeTakeFirst()

      if (cleanedEntity) {
        // Update original entity's parent_id to cleaned entity's id
        await db
          .updateTable("entities")
          .set({ parent_id: cleanedEntity.id }) // cast to number to satisfy type
          .where("id", "=", entity.id)
          .execute()

        console.log(
          `Updated entity ${entity.id}: ${entity.name} -> ${cleanedEntity.id}: ${cleanedName}`
        )
      } else {
        console.log(
          `No entity found with cleaned name "${cleanedName}" for original entity id ${entity.id}`
        )
      }
    }
  } catch (error) {
    console.error("Error fixing entity parents:", error)
    process.exit(1)
  }

  process.exit(0)
}
