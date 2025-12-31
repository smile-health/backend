import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const tableName = "manufacture_types"

  const manufactureTypes = [
    { id: 1, name: "Material" },
    { id: 2, name: "Asset" },
    { id: 3, name: "Vaksin" },
    { id: 4, name: "Kulkas" },
    { id: 5, name: "Logger" },
  ]

  for (const type of manufactureTypes) {
    await db
      .insertInto(tableName)
      .values(type)
      .onDuplicateKeyUpdate({
        name: type.name,
      })
      .execute()
  }
}
