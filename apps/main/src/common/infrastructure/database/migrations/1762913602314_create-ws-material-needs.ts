import { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("ws_material_needs")
    .addColumn("id", "bigint", (col) => col.autoIncrement().primaryKey())
    .addColumn("material_target_id", "bigint", (col) => col.notNull())
    .addColumn("reference_id", "bigint", (col) => col.notNull())
    .addColumn("reference_type", "varchar(50)", (col) => col.notNull())
    .addColumn("year", "integer", (col) => col.notNull())
    .addColumn("total_needs", "integer")
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  await db.schema
    .createIndex("material_need_target_id_idx")
    .on("ws_material_needs")
    .column("material_target_id")
    .execute()

  await db.schema
    .createIndex("material_need_reference_id_idx")
    .on("ws_material_needs")
    .column("reference_id")
    .execute()

  await db.schema
    .createIndex("material_need_reference_type_idx")
    .on("ws_material_needs")
    .column("reference_type")
    .execute()

  await db.schema
    .createIndex("material_need_year_idx")
    .on("ws_material_needs")
    .column("year")
    .execute()

  await db.schema
    .createIndex("material_need_deleted_at_idx")
    .on("ws_material_needs")
    .column("deleted_at")
    .execute()

  await db.schema
    .createIndex("material_need_polymorphic_idx")
    .on("ws_material_needs")
    .columns(["reference_type", "reference_id"])
    .execute()

  await db.schema
    .createIndex("material_need_poly_deleted_idx")
    .on("ws_material_needs")
    .columns(["reference_type", "reference_id", "deleted_at"])
    .execute()

  await db.schema
    .createIndex("material_need_target_year_idx")
    .on("ws_material_needs")
    .columns(["material_target_id", "year", "deleted_at"])
    .execute()

  await db.schema
    .createIndex("material_need_year_deleted_idx")
    .on("ws_material_needs")
    .columns(["year", "deleted_at"])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("ws_material_needs").execute()
}
