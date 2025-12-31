import { Kysely, sql } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("range_temperature")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("temperature_min", "double precision", (col) => col.notNull())
    .addColumn("temperature_max", "double precision", (col) => col.notNull())
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  // Add indexes for better query performance
  await db.schema
    .createIndex("idx_range_temperature_created_by")
    .on("range_temperature")
    .column("created_by")
    .execute()

  await db.schema
    .createIndex("idx_range_temperature_updated_by")
    .on("range_temperature")
    .column("updated_by")
    .execute()

  await db.schema
    .createIndex("idx_range_temperature_deleted_by")
    .on("range_temperature")
    .column("deleted_by")
    .execute()

  // Seed data
  const rangeTemperatures = [
    {
      temperature_min: 2.0,
      temperature_max: 8.0,
      created_by: null,
      updated_by: null,
      deleted_by: null,
      deleted_at: null,
      created_at: new Date('2024-05-29 16:13:00'),
      updated_at: new Date('2024-05-29 16:13:00')
    },
    {
      temperature_min: -25.0,
      temperature_max: -15.0,
      created_by: null,
      updated_by: null,
      deleted_by: null,
      deleted_at: null,
      created_at: new Date('2024-05-29 16:13:00'),
      updated_at: new Date('2024-05-29 16:13:00')
    }
  ]

  await db.insertInto("range_temperature").values(rangeTemperatures).execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("range_temperature").execute()
}