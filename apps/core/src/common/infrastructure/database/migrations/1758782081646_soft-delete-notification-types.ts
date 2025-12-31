import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

const whereCondition = [
  "asset-max",
  "asset-min",
  "book-all-entity",
  "cap-80",
  "device-offline",
  "ed-0",
  "ed-11",
  "ed-29",
  "ed-9",
  "material-kfa",
  "over-stock",
  "signal-below-20",
  "signal-20",
  "vaccine-2",
  "vaccine-3",
  "vaccine-2-2",
  "vaccine-4",
  "vaccine-5",
  "vaccine-7",
  "vaccine-8",
]

export async function up(db: Kysely<Database>): Promise<void> {
  await db
    .updateTable("notification_types")
    .set({ deleted_at: new Date() })
    .where("type", "in", whereCondition)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db
    .updateTable("notification_types")
    .set({ deleted_at: null })
    .where("type", "in", whereCondition)
    .execute()
}
