import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_activities")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("program_id", "integer", (col) => col.notNull())
    .addColumn("name", "varchar(255)", (col) => col.notNull())
    .addColumn("is_ordered_sales", "boolean", (col) => col.defaultTo(false))
    .addColumn("is_ordered_purchase", "boolean", (col) => col.defaultTo(false))
    .$call(addAuditColumns)
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_activity_material_types")
    .addColumn("activity_id", "bigint", (col) => col.notNull())
    .addColumn("material_type_id", "integer", (col) => col.notNull())
    .addColumn("is_patient", "boolean", (col) => col.defaultTo(false))
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_activities").execute()
  await db.schema.dropTable("ws_activity_material_types").execute()
}
