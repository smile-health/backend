import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const tableName = "religions"

  const religions = [
    { id: 1, title: "Islam" },
    { id: 2, title: "Kristen Protestan" },
    { id: 3, title: "Kristen Katolik" },
    { id: 4, title: "Buddha" },
    { id: 5, title: "Hindu" },
    { id: 6, title: "Konghucu" },
  ]

  for (const religion of religions) {
    await db
      .insertInto(tableName)
      .values(religion)
      .onDuplicateKeyUpdate({
        title: religion.title,
      })
      .execute()
  }
}
