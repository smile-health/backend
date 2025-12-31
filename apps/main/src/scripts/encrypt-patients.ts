import { db } from "@/common/infrastructure/database/index.js"
import { doEncrypt } from "@/modules/transaction/utils/transaction.encryption.js"
import { sql } from "kysely"

export const encryptPatients = async (batchSize = 1000) => {
  console.info("=== Start encrypting ws_patients fields...")

  let lastId = 0
  let processed = 0

  while (true) {
    const rows: Array<{
      id: number
      name: string | null
      birth_date: Date | null
      address: string | null
      residential_address: string | null
    }> = await db
      .selectFrom("ws_patients")
      .select(["id", "name", "birth_date", "address", "residential_address"])
      .where("id", ">", lastId)
      .where(sql<boolean>`enc_birth_date IS NULL`)
      .orderBy("id")
      .limit(batchSize)
      .execute()

    if (rows.length === 0) break

    for (const row of rows) {
      const id = row.id
      const name = row.name ?? null
      const address = row.address ?? null
      const residentialAddress = row.residential_address ?? null
      const birthDate = row.birth_date ? new Date(row.birth_date) : null

      const encName = name ? doEncrypt(name) : null
      const encAddress = address ? doEncrypt(address) : null
      const encResidential = residentialAddress
        ? doEncrypt(residentialAddress)
        : null
      const birthStr = birthDate
        ? `${birthDate.getUTCFullYear()}-${String(
            birthDate.getUTCMonth() + 1
          ).padStart(
            2,
            "0"
          )}-${String(birthDate.getUTCDate()).padStart(2, "0")}`
        : null
      const encBirth = birthStr ? doEncrypt(birthStr) : null

      await db
        .updateTable("ws_patients")
        .set({
          name: encName,
          address: encAddress,
          residential_address: encResidential,
          enc_birth_date: encBirth,
          updated_at: sql`CURRENT_TIMESTAMP`,
        })
        .where("id", "=", id)
        .execute()

      processed++
      lastId = id
    }

    console.info(`=== Processed batch up to id=${lastId} (total ${processed})`)
  }

  console.info(`=== Done. Total rows updated: ${processed}`)
}
