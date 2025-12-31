import { sql, type Kysely } from "kysely"
import { addTimestampColumns } from "../helper.js"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // Create integration_emonev_materials table
  await db.schema
    .createTable("integration_emonev_materials")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("material_id", "integer")
    .addColumn("tahun", "integer")
    .addColumn("nama_xls", "varchar(255)")
    .addColumn("type_rop", "varchar(255)")
    .addColumn("obat_id", "varchar(255)")
    .addColumn("uraian", "varchar(255)")
    .$call(addTimestampColumns)
    .execute()

  // Add unique constraint and indexes for integration_emonev_materials
  await db.schema
    .createIndex("obat_tahun")
    .on("integration_emonev_materials")
    .columns(["obat_id", "tahun"])
    .unique()
    .execute()

  await db.schema
    .createIndex("integration_emonev_materials_material_id")
    .on("integration_emonev_materials")
    .column("material_id")
    .execute()

  // Create integration_emonev_provinces table
  await db.schema
    .createTable("integration_emonev_provinces")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("province_id", "integer", (col) => col.notNull())
    .addColumn("trader_id", "varchar(255)")
    .addColumn("code", "varchar(255)")
    .addColumn("name", "varchar(255)")
    .addColumn("npwp", "varchar(255)")
    .addColumn("permit", "varchar(255)")
    .addColumn("permit_date", "date")
    .addColumn("pic", "varchar(255)")
    .addColumn("pic_email", "varchar(255)")
    .addColumn("pic_phone", "varchar(255)")
    .addColumn("pimpinan", "varchar(255)")
    .addColumn("pimpinan_phone", "varchar(255)")
    .addColumn("pimpinan_email", "varchar(255)")
    .$call(addTimestampColumns)
    .execute()

  // Add unique constraint and indexes for integration_emonev_provinces
  await db.schema
    .createIndex("trader_id_provinces")
    .on("integration_emonev_provinces")
    .column("trader_id")
    .unique()
    .execute()

  await db.schema
    .createIndex("integration_emonev_provinces_province_id")
    .on("integration_emonev_provinces")
    .column("province_id")
    .execute()

  // Create integration_emonev_regencies table
  await db.schema
    .createTable("integration_emonev_regencies")
    .addColumn("id", "integer", (col) => col.primaryKey())
    .addColumn("regency_id", "integer")
    .addColumn("bps_regency_id", "integer", (col) => col.defaultTo(0))
    .addColumn("trader_id", "varchar(255)")
    .addColumn("code", "varchar(255)")
    .addColumn("name", "varchar(255)")
    .addColumn("npwp", "varchar(255)")
    .addColumn("permit", "varchar(255)")
    .addColumn("permit_date", "date")
    .addColumn("pic", "varchar(255)")
    .addColumn("pic_email", "varchar(255)")
    .addColumn("pic_phone", "varchar(255)")
    .addColumn("pimpinan", "varchar(255)")
    .addColumn("pimpinan_phone", "varchar(255)")
    .addColumn("pimpinan_email", "varchar(255)")
    .$call(addTimestampColumns)
    .execute()

  // Create integration_emonev_regencies_updated table
  await db.schema
    .createTable("integration_emonev_regencies_updated")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("regency_id", "integer")
    .addColumn("bps_regency_id", "integer", (col) => col.defaultTo(0))
    .addColumn("trader_id", "varchar(255)")
    .addColumn("code", "varchar(255)")
    .addColumn("name", "varchar(255)")
    .addColumn("npwp", "varchar(255)")
    .addColumn("permit", "varchar(255)")
    .addColumn("permit_date", "date")
    .addColumn("pic", "varchar(255)")
    .addColumn("pic_email", "varchar(255)")
    .addColumn("pic_phone", "varchar(255)")
    .addColumn("pimpinan", "varchar(255)")
    .addColumn("pimpinan_phone", "varchar(255)")
    .addColumn("pimpinan_email", "varchar(255)")
    .$call(addTimestampColumns)
    .execute()

  // Add unique constraint and indexes for integration_emonev_regencies_updated
  await db.schema
    .createIndex("trader_id_regencies_updated")
    .on("integration_emonev_regencies_updated")
    .column("trader_id")
    .unique()
    .execute()

  await db.schema
    .createIndex("integration_emonev_regencies_regency_id")
    .on("integration_emonev_regencies_updated")
    .column("regency_id")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await Promise.all([
    db.schema.dropTable("integration_emonev_materials").execute(),
    db.schema.dropTable("integration_emonev_provinces").execute(),
    db.schema.dropTable("integration_emonev_regencies").execute(),
    db.schema.dropTable("integration_emonev_regencies_updated").execute(),
  ])
}