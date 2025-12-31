import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("logger_status")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("name", "varchar(255)")
    .$call(addTimestampColumns)
    .execute()

  // Seed data
  const loggerStatuses = [
    {
      name: "Aktif",
      created_at: new Date('2024-07-22 17:07:20'),
      updated_at: new Date('2024-07-22 17:07:20'),
      deleted_at: null
    },
    {
      name: "Tidak Aktif",
      created_at: new Date('2024-07-22 17:07:20'),
      updated_at: new Date('2024-07-22 17:07:20'),
      deleted_at: null
    },
    {
      name: "Unsubscribes",
      created_at: new Date('2024-07-22 17:07:20'),
      updated_at: new Date('2024-07-22 17:07:20'),
      deleted_at: null
    }
  ]

  await db.insertInto("logger_status").values(loggerStatuses).execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("logger_status").execute()
}