import type { Kysely } from "kysely"
import { addAuditColumns, addTimestampColumns } from "../helper"

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Buat tabel utama: coldstorages
  await db.schema
    .createTable("coldstorages")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("entity_id", "bigint", (col) => col.notNull().references("entities.id").onDelete("cascade"))
    .addColumn("volume_asset", "double precision", (col) => col.notNull().defaultTo(0))
    .addColumn("total_volume", "double precision", (col) => col.notNull().defaultTo(0))
    .addColumn("percentage_capacity", "double precision", (col) => col.notNull().defaultTo(0))
    .addColumn("projection_volume_asset", "double precision", (col) => col.defaultTo(0))
    .addColumn("projection_total_volume", "double precision", (col) => col.defaultTo(0))
    .addColumn("projection_percentage_capacity", "double precision", (col) => col.defaultTo(0))
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  // 2. Buat tabel: coldstorage_per_temperature
  await db.schema
    .createTable("coldstorage_per_temperature")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("coldstorage_id", "bigint", (col) => col.notNull().references("coldstorages.id").onDelete("cascade"))
    .addColumn("entity_id", "bigint", (col) => col.notNull().references("entities.id").onDelete("cascade"))
    .addColumn("temperature_threshold_id", "bigint", (col) => col.notNull().references("temperature_thresholds.id").onDelete("cascade"))
    .addColumn("volume_asset", "double precision", (col) => col.notNull().defaultTo(0))
    .addColumn("total_volume", "double precision", (col) => col.notNull().defaultTo(0))
    .addColumn("percentage_capacity", "double precision", (col) => col.notNull().defaultTo(0))
    .addColumn("projection_volume_asset", "double precision", (col) => col.defaultTo(0))
    .addColumn("projection_total_volume", "double precision", (col) => col.defaultTo(0))
    .addColumn("projection_percentage_capacity", "double precision", (col) => col.defaultTo(0))
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()

  // 3. Buat tabel: coldstorage_materials
  await db.schema
    .createTable("coldstorage_materials")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("coldstorage_id", "bigint", (col) => col.notNull().references("coldstorages.id").onDelete("cascade"))
    .addColumn("entity_id", "bigint", (col) => col.notNull().references("entities.id").onDelete("cascade"))
    .addColumn("material_id", "bigint", (col) => col.notNull())
    .addColumn("dosage_stock", "double precision", (col) => col.defaultTo(0))
    .addColumn("vial_stock", "double precision", (col) => col.defaultTo(0))
    .addColumn("package_stock", "double precision", (col) => col.defaultTo(0))
    .addColumn("package_volume", "double precision", (col) => col.defaultTo(0))
    .addColumn("remain_package_fulfill", "double precision", (col) => col.defaultTo(0))
    .addColumn("volume_per_liter", "double precision", (col) => col.defaultTo(0))
    .addColumn("max_dosage", "double precision", (col) => col.defaultTo(0))
    .addColumn("recommend_order_base_on_max", "double precision", (col) => col.defaultTo(0))
    .addColumn("projection_stock", "double precision", (col) => col.defaultTo(0))
    .addColumn("projection_vial_stock", "double precision", (col) => col.defaultTo(0))
    .addColumn("projection_package_stock", "double precision", (col) => col.defaultTo(0))
    .addColumn("projection_package_volume", "double precision", (col) => col.defaultTo(0))
    .$call(addTimestampColumns)
    .$call(addAuditColumns)
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("coldstorage_materials").execute()
  await db.schema.dropTable("coldstorage_per_temperature").execute()
  await db.schema.dropTable("coldstorages").execute()
}