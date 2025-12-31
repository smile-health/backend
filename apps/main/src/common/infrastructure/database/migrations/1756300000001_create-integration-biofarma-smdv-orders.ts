import type { Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("integration_biofarma_smdv_orders")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("biofarma_id", "bigint", (col) => col.notNull())
    .addColumn("nomor_do", "varchar(255)")
    .addColumn("tanggal_do", "date")
    .addColumn("nomor_po", "varchar(255)")
    .addColumn("kode_area", "varchar(255)")
    .addColumn("pengiriman", "varchar(255)")
    .addColumn("tujuan_pengiriman", "varchar(255)")
    .addColumn("alamat", "varchar(255)")
    .addColumn("nama_produk", "varchar(255)")
    .addColumn("no_batch", "varchar(255)")
    .addColumn("expired_date", "date")
    .addColumn("jumlah_vial", "decimal")
    .addColumn("jumlah_dosis", "decimal")
    .addColumn("status", "varchar(255)")
    .addColumn("tanggal_terima", "datetime")
    .addColumn("jenis_layanan", "varchar(255)")
    .addColumn("nomor_surat_alokasi", "varchar(255)")
    .addColumn("keterangan", "varchar(255)")
    .addColumn("kode_hub", "varchar(255)")
    .addColumn("tipe_vaksin", "varchar(255)")
    .addColumn("tanggal_pickup", "datetime")
    .addColumn("nama_smdv", "varchar(255)")
    .addColumn("do_pusat", "varchar(255)")
    .$call(addTimestampColumns)
    .execute()

  // Create unique index
  await db.schema
    .createIndex("biofarma_smdv_orders_index")
    .on("integration_biofarma_smdv_orders")
    .column("biofarma_id")
    .unique()
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("integration_biofarma_smdv_orders").execute()
}