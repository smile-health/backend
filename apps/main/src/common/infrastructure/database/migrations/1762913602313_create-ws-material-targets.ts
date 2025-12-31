import { Kysely, sql } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_material_targets")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("category", sql`ENUM('bias','non_bias')`, (col) => col.notNull())
    .addColumn("type", sql`ENUM('primary','additional')`, (col) =>
      col.notNull()
    )
    .addColumn("injection_month", "varchar(255)")
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("material_target_material_id_idx")
    .on("ws_material_targets")
    .column("material_id")
    .execute()

  await db.schema
    .createIndex("material_target_category_idx")
    .on("ws_material_targets")
    .column("category")
    .execute()

  await db.schema
    .createIndex("material_target_type_idx")
    .on("ws_material_targets")
    .column("type")
    .execute()

  await db.schema
    .createIndex("material_target_deleted_at_idx")
    .on("ws_material_targets")
    .column("deleted_at")
    .execute()

  await db.schema
    .createIndex("material_target_category_deleted_idx")
    .on("ws_material_targets")
    .columns(["category", "deleted_at"])
    .execute()

  await db.schema
    .createIndex("material_target_type_deleted_idx")
    .on("ws_material_targets")
    .columns(["type", "deleted_at"])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_material_targets").execute()
}
