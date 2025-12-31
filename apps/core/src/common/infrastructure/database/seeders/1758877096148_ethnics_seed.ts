import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const tableName = "ethnics"

  const ethnics = [
    { id: 1, title: "Aceh" },
    { id: 2, title: "Adonara Timur" },
    { id: 3, title: "Ambon" },
    { id: 4, title: "Bali" },
    { id: 5, title: "Banjar" },
    { id: 6, title: "Batak" },
    { id: 7, title: "Berau" },
    { id: 8, title: "Betawi" },
    { id: 9, title: "Bima" },
    { id: 10, title: "Bugis " },
    { id: 11, title: "Buton" },
    { id: 12, title: "China Tionghoa" },
    { id: 13, title: "Dayak" },
    { id: 14, title: "Flores" },
    { id: 15, title: "Jawa" },
    { id: 16, title: "Kaili" },
    { id: 17, title: "Komering" },
    { id: 18, title: "Kutai" },
    { id: 19, title: "Madura" },
    { id: 20, title: "Manggarai" },
    { id: 21, title: "Melayu" },
    { id: 22, title: "Minahasa" },
    { id: 23, title: "Minang" },
    { id: 24, title: "NTT" },
    { id: 25, title: "Padang" },
    { id: 26, title: "Sasak" },
    { id: 27, title: "Sunda" },
    { id: 28, title: "Timor" },
    { id: 29, title: "Toraja" },
  ]

  for (const ethnic of ethnics) {
    await db
      .insertInto(tableName)
      .values(ethnic)
      .onDuplicateKeyUpdate({
        title: ethnic.title,
      })
      .execute()
  }
}
