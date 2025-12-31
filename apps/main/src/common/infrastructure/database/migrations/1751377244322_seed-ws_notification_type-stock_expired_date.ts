import { type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // 1, 3, 10, 14, 30, 60, or 90 days before the expiration date
  const notification_types = [
    {
      id: 5,
      title: "notification.type.ed_1",
      type: "ed-1",
    },
    {
      id: 6,
      title: "notification.type.ed_3",
      type: "ed-3",
    },
    {
      id: 7,
      title: "notification.type.ed_10",
      type: "ed-10",
    },
    {
      id: 8,
      title: "notification.type.ed_14",
      type: "ed-14",
    },
    {
      id: 9,
      title: "notification.type.ed_30",
      type: "ed-30",
    },
    {
      id: 10,
      title: "notification.type.ed_60",
      type: "ed-60",
    },
    {
      id: 11,
      title: "notification.type.ed_90",
      type: "ed-90",
    },
    {
      id: 12,
      title: "notification.type.order_ship",
      type: "order-ship",
    },
    {
      id: 13,
      title: "notification.type.order_relocation",
      type: "order-relocation",
    },
  ]

  await db.insertInto("notification_types").values(notification_types).execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.deleteFrom("notification_types").execute()
}
