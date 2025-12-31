import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const typesToBeInserted = [
    { id: 3, type: "zero-stock" },
    { id: 4, type: "less-stock" },
    { id: 5, type: "ed-1" },
    { id: 6, type: "ed-3" },
    { id: 7, type: "ed-10" },
    { id: 8, type: "ed-14" },
    { id: 9, type: "ed-30" },
    { id: 10, type: "ed-60" },
    { id: 11, type: "ed-90" },
    { id: 12, type: "order-ship" },
    { id: 13, type: "order-relocation" },
    { id: 14, type: "asset-maintenance" },
    { id: 15, type: "asset-calibration" },
    { id: 18, type: "asset-status-changed" },
    { id: 26, type: "inactive-entity" },
    { id: 31, type: "stock-back-to-normal" },
    { id: 40, type: "asset-warranty" },
    { id: 41, type: "above-excursion" },
    { id: 42, type: "below-excursion" },
  ]

  console.log("Seeding notification types...")

  // Clear existing types
  await db.deleteFrom("notification_types").execute()

  const notificationTypes = typesToBeInserted.map((item) => ({
    title: `notification.type.${item.type.replace(/[-\s]/g, "_")}`,
    type: item.type.toLowerCase().replaceAll(" ", "-"),
    id: item.id,
  }))

  // Insert new types with upsert to avoid duplicates
  await db
    .insertInto("notification_types")
    .values(notificationTypes)
    .onDuplicateKeyUpdate(() => ({
      updated_at: new Date(),
    }))
    .execute()

  console.log("Notification types seeded.")
}
