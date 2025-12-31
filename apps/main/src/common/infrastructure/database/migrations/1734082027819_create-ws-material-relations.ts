import { Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_material_permissions")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("action", "integer", (col) => col.notNull())
    .addColumn("key", "varchar(255)", (col) => col.notNull())
    .addColumn("value", "integer", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_material_companions")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("companion_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_material_manufactures")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("manufacture_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()

  await db.schema
    .createTable("ws_material_activities")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("activity_id", "bigint", (col) => col.notNull())
    .addColumn("is_sequence", "boolean", (col) => col.defaultTo(false))
    .$call(addTimestampColumns)
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_material_activities").execute()
  await db.schema.dropTable("ws_material_manufactures").execute()
  await db.schema.dropTable("ws_material_companions").execute()
  await db.schema.dropTable("ws_material_permissions").execute()
}
