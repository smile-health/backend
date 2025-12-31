import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const tableName = "reactions"

  const reactions = [
    { id: 1, title: "Demam" },
    { id: 2, title: "Ruam Merah" },
    { id: 3, title: "Kejang" },
    { id: 4, title: "Lainnya" },
  ]

  for (const reaction of reactions) {
    await db
      .insertInto(tableName)
      .values(reaction)
      .onDuplicateKeyUpdate({
        title: reaction.title,
      })
      .execute()
  }
}
