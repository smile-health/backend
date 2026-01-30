import { collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"
import { getMapOrderIds } from "../../../helper.js"

export const migrateBiofarmaOrders = async (
  batchSize: number,
  programId = 1
) => {
  const startTime = new Date()
  console.info(`Migration Biofarma Orders started at: ${startTime.toLocaleString()}`)
  
  const migrationDB = getMigrationDB(programId)
  
  let totalCount = 0
  let page = 0
  
  try {
    while (true) {
      const rows = await migrationDB
        .selectFrom("biofarma_orders as bo")
        .select(["bo.id"])
        .orderBy("bo.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      
      const orderIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const count = await doMigrateBiofarmaOrders(trx, migrationDB, orderIds)
        totalCount += count
      })

      page++
      console.log(`Biofarma Orders batch ${page} completed (${rows.length} records)`);
    }

    console.info(`✅ Biofarma Orders migration completed: ${totalCount} records`)
    return { count: totalCount }
  } catch (error) {
    console.error("❌ Biofarma Orders migration failed")
    console.error(error)
    throw error
  }
}

export const doMigrateBiofarmaOrders = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  orderIds: number[]
) => {
  const orders = await migrationDB
    .selectFrom("biofarma_orders as bo")
    .select([
      "bo.id as biofarma_id",
      "bo.no_do",
      "bo.tanggal_do",
      "bo.no_po",
      "bo.kode_area",
      "bo.pengirim",
      "bo.tujuan",
      "bo.alamat",
      "bo.produk",
      "bo.no_batch",
      "bo.expired_date",
      "bo.jm_vial",
      "bo.jm_dosis",
      "bo.status",
      "bo.tanggal_terima",
      "bo.created_at",
      "bo.updated_at",
      "bo.exist_smile",
      "bo.jm_vial_terima",
      "bo.jm_dosis_terima",
      "bo.tanggal_kirim",
      "bo.biofarma_type",
      "bo.service_type",
      "bo.no_document",
      "bo.released_date",
      "bo.notes",
      "bo.code_product_kemenkes",
      "bo.entrance_type",
      "bo.grant_country",
      "bo.manufacture_country"
    ])
    .where("bo.id", "in", orderIds)
    .execute()

  if (orders.length === 0) {
    return 0
  }

  // Get mapping from existing order IDs to platform order IDs
  const existingOrderIds = orders
    .map(order => order.exist_smile)
    .filter(id => id !== null && id !== undefined) as number[]
  
  const orderMapping = await getMapOrderIds(1, existingOrderIds)

  // Insert into integration_biofarma_orders table
  const insertData = orders.map(order => ({
    biofarma_id: order.biofarma_id,
    no_do: order.no_do,
    tanggal_do: order.tanggal_do,
    no_po: order.no_po,
    kode_area: order.kode_area,
    pengirim: order.pengirim,
    tujuan: order.tujuan,
    alamat: order.alamat,
    produk: order.produk,
    no_batch: order.no_batch,
    expired_date: order.expired_date,
    jm_vial: order.jm_vial,
    jm_dosis: order.jm_dosis,
    status: order.status,
    tanggal_terima: order.tanggal_terima,
    created_at: order.created_at || new Date(),
    updated_at: order.updated_at || new Date(),
    exist_smile: orderMapping[order.exist_smile as number] || order.exist_smile,
    jm_vial_terima: order.jm_vial_terima,
    jm_dosis_terima: order.jm_dosis_terima,
    tanggal_kirim: order.tanggal_kirim,
    biofarma_type: order.biofarma_type,
    service_type: order.service_type,
    no_document: order.no_document,
    released_date: order.released_date,
    notes: order.notes,
    code_product_kemenkes: order.code_product_kemenkes,
    entrance_type: order.entrance_type,
    grant_country: order.grant_country,
    manufacture_country: order.manufacture_country
  }))

  await trx
    .insertInto("integration_biofarma_orders")
    .values(insertData)
    .onDuplicateKeyUpdate({
      tanggal_do: (eb) => eb.ref("tanggal_do"),
      no_po: (eb) => eb.ref("no_po"),
      kode_area: (eb) => eb.ref("kode_area"),
      pengirim: (eb) => eb.ref("pengirim"),
      tujuan: (eb) => eb.ref("tujuan"),
      alamat: (eb) => eb.ref("alamat"),
      produk: (eb) => eb.ref("produk"),
      expired_date: (eb) => eb.ref("expired_date"),
      jm_vial: (eb) => eb.ref("jm_vial"),
      jm_dosis: (eb) => eb.ref("jm_dosis"),
      status: (eb) => eb.ref("status"),
      tanggal_terima: (eb) => eb.ref("tanggal_terima"),
      exist_smile: (eb) => eb.ref("exist_smile"),
      jm_dosis_terima: (eb) => eb.ref("jm_dosis_terima"),
      jm_vial_terima: (eb) => eb.ref("jm_vial_terima"),
      tanggal_kirim: (eb) => eb.ref("tanggal_kirim"),
      service_type: (eb) => eb.ref("service_type"),
      no_document: (eb) => eb.ref("no_document"),
      released_date: (eb) => eb.ref("released_date"),
      notes: (eb) => eb.ref("notes"),
      code_product_kemenkes: (eb) => eb.ref("code_product_kemenkes"),
      entrance_type: (eb) => eb.ref("entrance_type"),
      grant_country: (eb) => eb.ref("grant_country"),
      manufacture_country: (eb) => eb.ref("manufacture_country"),
    })
    .execute()

  return orders.length
}