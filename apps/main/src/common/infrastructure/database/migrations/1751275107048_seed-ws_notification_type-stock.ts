import { type Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const notification_types = [
    // {
    //   id: 1,
    //   title: "notification.type.unplug_power",
    //   type: "unplug-power",
    // },
    // {
    //   id: 2,
    //   title: "notification.type.export_large_file",
    //   type: "export-large-file",
    // },
    {
      id: 3,
      title: "notification.type.zero_stock",
      type: "zero-stock",
    },
    {
      id: 4,
      title: "notification.type.less_stock",
      type: "less-stock",
    },
  ]

  await db.insertInto("notification_types").values(notification_types).execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.deleteFrom("notification_types").execute()
}
