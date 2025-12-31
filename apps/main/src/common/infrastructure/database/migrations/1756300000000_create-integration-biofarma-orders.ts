import type { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("integration_biofarma_orders")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("biofarma_id", "integer")
    .addColumn("no_do", "varchar(255)")
    .addColumn("tanggal_do", "datetime")
    .addColumn("no_po", "varchar(255)")
    .addColumn("kode_area", "varchar(255)")
    .addColumn("pengirim", "varchar(255)")
    .addColumn("tujuan", "varchar(255)")
    .addColumn("alamat", "varchar(255)")
    .addColumn("produk", "varchar(255)")
    .addColumn("no_batch", "varchar(255)")
    .addColumn("expired_date", "datetime")
    .addColumn("jm_vial", "integer")
    .addColumn("jm_dosis", "integer")
    .addColumn("status", "varchar(255)")
    .addColumn("tanggal_terima", "datetime")
    .addColumn("exist_smile", "integer")
    .addColumn("jm_vial_terima", "integer")
    .addColumn("jm_dosis_terima", "integer")
    .addColumn("tanggal_kirim", "datetime")
    .addColumn("biofarma_type", "varchar(255)")
    .addColumn("service_type", "integer")
    .addColumn("no_document", "varchar(255)")
    .addColumn("released_date", "datetime")
    .addColumn("notes", "text")
    .addColumn("code_product_kemenkes", "varchar(255)")
    .addColumn("entrance_type", "varchar(255)")
    .addColumn("grant_country", "varchar(255)")
    .addColumn("manufacture_country", "varchar(255)")
    .$call(addTimestampColumns)
    .execute()

  // Create unique index
  await db.schema
    .createIndex("biofarma_orders_unique_index")
    .on("integration_biofarma_orders")
    .columns(["no_do", "no_batch", "biofarma_type"])
    .unique()
    .execute()

  // Create indexes
  await db.schema
    .createIndex("biofarma_orders_no_do")
    .on("integration_biofarma_orders")
    .column("no_do")
    .execute()

  await db.schema
    .createIndex("biofarma_orders_biofarma_type")
    .on("integration_biofarma_orders")
    .column("biofarma_type")
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("integration_biofarma_orders").execute()
}