import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const tableName = "educations"

  const educations = [
    { id: 1, title: "TIDAK / BELUM SEKOLAH" },
    { id: 2, title: "BELUM TAMAT SD/SEDERAJAT" },
    { id: 3, title: "TAMAT SD / SEDERAJAT" },
    { id: 4, title: "SLTP/SEDERAJAT" },
    { id: 5, title: "SLTA / SEDERAJAT" },
    { id: 6, title: "DIPLOMA I / II" },
    { id: 7, title: "AKADEMI/ DIPLOMA III/S. MUDA" },
    { id: 8, title: "DIPLOMA IV/ STRATA I" },
    { id: 9, title: "STRATA II" },
    { id: 10, title: "STRATA III" },
  ]

  for (const education of educations) {
    await db
      .insertInto(tableName)
      .values(education)
      .onDuplicateKeyUpdate({
        title: education.title,
      })
      .execute()
  }
}
