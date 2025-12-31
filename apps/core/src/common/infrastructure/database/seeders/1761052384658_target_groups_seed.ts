import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const groups = [
    { title: "Bayi Lahir Hidup (Cek)" },
    { title: "Bayi Surviving Infant" },
    { title: "Anak Baduta" },
    { title: "Murid Kelas 1 SD" },
    { title: "Murid Kelas 2 SD" },
    { title: "Murid Kelas 5 SD" },
    { title: "Murid Wanita Kelas 5 SD" },
    { title: "Murid Wanita Kelas 6 SD" },
    { title: "Wanita Usia Subur (termasuk Ibu hamil)" },
    { title: "Murid Wanita Kelas 9 (15 Tahun)" },
    { title: "Murid Laki-Laki Kelas 5 SD" },
  ]

  for (const item of groups) {
    await db
      .insertInto("target_groups")
      .values(item)
      .onDuplicateKeyUpdate({
        title: item.title,
      })
      .execute()
  }
}
