import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateBiofarmaSmdvOrders = async (
  batchSize: number,
  programId = 1
) => {
  const startTime = new Date()
  console.info(`Migration Biofarma SMDV Orders started at: ${startTime.toLocaleString()}`)
  
  const migrationDB = getMigrationDB(programId)
  
  let totalCount = 0
  let page = 0
  
  try {
    while (true) {
      const rows = await migrationDB
        .selectFrom("biofarma_smdv_orders as bso")
        .select(["bso.id"])
        .orderBy("bso.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      
      const orderIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const count = await doMigrateBiofarmaSmdvOrders(trx, migrationDB, orderIds)
        totalCount += count
      })

      page++
      console.log(`Biofarma SMDV Orders batch ${page} completed (${rows.length} records)`);
    }

    console.info(`✅ Biofarma SMDV Orders migration completed: ${totalCount} records`)
    return { count: totalCount }
  } catch (error) {
    console.error("❌ Biofarma SMDV Orders migration failed")
    console.error(error)
    throw error
  }
}

export const doMigrateBiofarmaSmdvOrders = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  orderIds: number[]
) => {
  const orders = await migrationDB
    .selectFrom("biofarma_smdv_orders as bso")
    .select([
      "bso.id as biofarma_id",
      "bso.nomor_do",
      "bso.tanggal_do",
      "bso.nomor_po",
      "bso.kode_area",
      "bso.pengiriman",
      "bso.tujuan_pengiriman",
      "bso.alamat",
      "bso.nama_produk",
      "bso.no_batch",
      "bso.expired_date",
      "bso.jumlah_vial",
      "bso.jumlah_dosis",
      "bso.status",
      "bso.tanggal_terima",
      "bso.jenis_layanan",
      "bso.nomor_surat_alokasi",
      "bso.keterangan",
      "bso.kode_hub",
      "bso.tipe_vaksin",
      "bso.tanggal_pickup",
      "bso.nama_smdv",
      "bso.do_pusat",
      "bso.created_at",
      "bso.updated_at"
    ])
    .where("bso.id", "in", orderIds)
    .execute()

  if (orders.length === 0) {
    return 0
  }

  // Insert into integration_biofarma_smdv_orders table
  const insertData = orders.map(order => ({
    biofarma_id: order.biofarma_id,
    nomor_do: order.nomor_do,
    tanggal_do: order.tanggal_do,
    nomor_po: order.nomor_po,
    kode_area: order.kode_area,
    pengiriman: order.pengiriman,
    tujuan_pengiriman: order.tujuan_pengiriman,
    alamat: order.alamat,
    nama_produk: order.nama_produk,
    no_batch: order.no_batch,
    expired_date: order.expired_date,
    jumlah_vial: order.jumlah_vial,
    jumlah_dosis: order.jumlah_dosis,
    status: order.status,
    tanggal_terima: order.tanggal_terima,
    jenis_layanan: order.jenis_layanan,
    nomor_surat_alokasi: order.nomor_surat_alokasi,
    keterangan: order.keterangan,
    kode_hub: order.kode_hub,
    tipe_vaksin: order.tipe_vaksin,
    tanggal_pickup: order.tanggal_pickup,
    nama_smdv: order.nama_smdv,
    do_pusat: order.do_pusat,
    created_at: order.created_at || new Date(),
    updated_at: order.updated_at || new Date(),
    deleted_at: null
  }))

  await trx
    .insertInto("integration_biofarma_smdv_orders")
    .values(insertData)
    .onDuplicateKeyUpdate({
      nomor_do: (eb) => eb.ref("nomor_do"),
      tanggal_do: (eb) => eb.ref("tanggal_do"),
      nomor_po: (eb) => eb.ref("nomor_po"),
      kode_area: (eb) => eb.ref("kode_area"),
      pengiriman: (eb) => eb.ref("pengiriman"),
      tujuan_pengiriman: (eb) => eb.ref("tujuan_pengiriman"),
      alamat: (eb) => eb.ref("alamat"),
      nama_produk: (eb) => eb.ref("nama_produk"),
      no_batch: (eb) => eb.ref("no_batch"),
      expired_date: (eb) => eb.ref("expired_date"),
      jumlah_vial: (eb) => eb.ref("jumlah_vial"),
      jumlah_dosis: (eb) => eb.ref("jumlah_dosis"),
      status: (eb) => eb.ref("status"),
      tanggal_terima: (eb) => eb.ref("tanggal_terima"),
      jenis_layanan: (eb) => eb.ref("jenis_layanan"),
      nomor_surat_alokasi: (eb) => eb.ref("nomor_surat_alokasi"),
      keterangan: (eb) => eb.ref("keterangan"),
      kode_hub: (eb) => eb.ref("kode_hub"),
      tipe_vaksin: (eb) => eb.ref("tipe_vaksin"),
      tanggal_pickup: (eb) => eb.ref("tanggal_pickup"),
      nama_smdv: (eb) => eb.ref("nama_smdv"),
      do_pusat: (eb) => eb.ref("do_pusat"),
    })
    .execute()

  return orders.length
}