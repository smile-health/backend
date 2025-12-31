import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_entity_activities")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("entity_id", "bigint", (col) => col.notNull())
    .addColumn("activity_id", "bigint", (col) => col.notNull())
    .addColumn("start_date", "datetime")
    .addColumn("end_date", "datetime")
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_entity_material_activities")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("entity_id", "bigint", (col) => col.notNull())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("activity_id", "bigint", (col) => col.notNull())
    .addColumn("min", "double precision", (col) => col.defaultTo(0))
    .addColumn("max", "double precision", (col) => col.defaultTo(0))
    .addColumn("consumption_rate", "double precision", (col) =>
      col.defaultTo(0)
    )
    .addColumn("retailer_price", "double precision", (col) => col.defaultTo(0))
    .addColumn("tax", "double precision", (col) => col.defaultTo(0))
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createTable("ws_customer_vendors")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "integer", (col) => col.notNull())
    .addColumn("customer_id", "bigint", (col) => col.notNull())
    .addColumn("vendor_id", "bigint", (col) => col.notNull())
    .addColumn("is_distribution", "boolean", (col) => col.defaultTo(false))
    .addColumn("is_consumption", "boolean", (col) => col.defaultTo(false))
    .addColumn("is_extermination", "boolean", (col) => col.defaultTo(false))
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_customer_vendor_activities")
    .addColumn("customer_vendor_id", "bigint", (col) => col.notNull())
    .addColumn("activity_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_customer_vendor_activities").execute()
  await db.schema.dropTable("ws_customer_vendors").execute()
  await db.schema.dropTable("ws_entity_activities").execute()
}
