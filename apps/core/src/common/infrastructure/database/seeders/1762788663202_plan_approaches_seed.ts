import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const groups = [{ name: "Vaccination" }]

  for (const item of groups) {
    await db
      .insertInto("plan_approaches")
      .values(item)
      .onDuplicateKeyUpdate({
        name: item.name,
      })
      .execute()
  }
}
