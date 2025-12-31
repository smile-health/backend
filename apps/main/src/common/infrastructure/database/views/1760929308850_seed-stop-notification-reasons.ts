import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const tableName = "ws_stop_notification_reasons"

  const stopNotificationReasons = [
    { id: 1, title: "Hewan Penular Rabies Hidup", protocol_id: 1 },
    { id: 2, title: "Hewan Penular Rabies Mati Bukan Rabies", protocol_id: 1 },
  ]

  for (const reason of stopNotificationReasons) {
    await db
      .insertInto(tableName)
      .values(reason)
      .onDuplicateKeyUpdate({
        title: reason.title,
        protocol_id: reason.protocol_id,
      })
      .execute()
  }
}
