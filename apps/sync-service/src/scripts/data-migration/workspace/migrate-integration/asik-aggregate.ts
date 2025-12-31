import { logger } from "@smile/lib/logger.js"
import { Kysely } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import { MigrationDB } from "../../../types.js"
import {
  getMapEntityIds,
  getMapMaterialIds,
  getMapBatchIds,
} from "../../../helper.js"

export const migrateAsikAggregate = async (
  batchSize: number,
  programId: number
) => {
  const migrationDB = getMigrationDB(programId)
  let offset = 0
  let totalProcessed = 0

  logger.info(`Starting ASIK Aggregate migration for program ${programId}`)

  while (true) {
    const result = await doMigrateAsikAggregate(
      migrationDB,
      programId,
      batchSize,
      offset
    )

    if (result === 0) {
      break
    }

    totalProcessed += result
    offset += batchSize

    logger.info(
      `Processed ${result} ASIK Aggregate records (total: ${totalProcessed})`
    )
  }

  logger.info(
    `ASIK Aggregate migration completed. Total processed: ${totalProcessed}`
  )

  return { count: totalProcessed }
}

const doMigrateAsikAggregate = async (
  migrationDB: Kysely<MigrationDB>,
  programId: number,
  batchSize: number,
  offset: number
) => {
  return await db.transaction().execute(async (trx) => {
    // Fetch ASIK Aggregate data from source
    const asikAggregateData = await migrationDB
      .selectFrom("integration_asik_aggregate as aa")
      .select([
        "aa.id",
        "aa.customer_id",
        "aa.pos_imunisasi_asik",
        "aa.vendor_id",
        "aa.puskesmas_asik",
        "aa.master_material_id as material_id",
        "aa.vaksin_asik",
        "aa.batch_number_asik",
        "aa.batch_id_smile",
        "aa.batch_code_smile",
        "aa.injection_date",
        "aa.aggregate",
        "aa.input_date",
        "aa.pos_imunisasi_asik_province_id",
        "aa.pos_imunisasi_asik_regency_id",
        "aa.pos_imunisasi_asik_subdistrict_id",
        "aa.puskesmas_asik_province_id",
        "aa.puskesmas_asik_regency_id",
        "aa.puskesmas_asik_subdistrict_id",
        "aa.page",
        "aa.createdAt",
        "aa.updatedAt",
      ])
      .limit(batchSize)
      .offset(offset)
      .execute()

    if (asikAggregateData.length === 0) {
      return 0
    }

    // Get unique IDs for mapping
    const customerIds = [...new Set(asikAggregateData.map(item => item.customer_id).filter(Boolean))]
    const vendorIds = [...new Set(asikAggregateData.map(item => item.vendor_id).filter(Boolean))]
    const materialIds = [...new Set(asikAggregateData.map(item => item.material_id).filter(Boolean))]
    const batchIds = [...new Set(asikAggregateData.map(item => item.batch_id_smile).filter(Boolean))]

    // Get mappings
    const mapCustomerIds = await getMapEntityIds(programId, customerIds)
    const mapVendorIds = await getMapEntityIds(programId, vendorIds)
    const mapMaterialIds = await getMapMaterialIds(programId, materialIds)
    const mapBatchIds = await getMapBatchIds(programId, batchIds)

    // Prepare data for insertion
    const insertData = asikAggregateData.map((item) => ({
      customer_id: mapCustomerIds[item.customer_id] || null,
      pos_imunisasi_asik: item.pos_imunisasi_asik,
      vendor_id: mapVendorIds[item.vendor_id] || null,
      puskesmas_asik: item.puskesmas_asik,
      material_id: mapMaterialIds[item.material_id] || null,
      vaksin_asik: item.vaksin_asik,
      batch_number_asik: item.batch_number_asik,
      batch_id_smile: mapBatchIds[item.batch_id_smile] || null,
      batch_code_smile: item.batch_code_smile,
      injection_date: item.injection_date,
      aggregate: item.aggregate,
      input_date: item.input_date,
      pos_imunisasi_asik_province_id: item.pos_imunisasi_asik_province_id,
      pos_imunisasi_asik_regency_id: item.pos_imunisasi_asik_regency_id,
      pos_imunisasi_asik_subdistrict_id: item.pos_imunisasi_asik_subdistrict_id,
      puskesmas_asik_province_id: item.puskesmas_asik_province_id,
      puskesmas_asik_regency_id: item.puskesmas_asik_regency_id,
      puskesmas_asik_subdistrict_id: item.puskesmas_asik_subdistrict_id,
      page: item.page,
      created_at: item.created_at || new Date(),
      updated_at: item.updated_at || new Date(),
    }))

    // Insert into integration_asik_aggregate with on duplicate key update
    await trx
      .insertInto("integration_asik_aggregate")
      .values(insertData)
      .onDuplicateKeyUpdate({
        customer_id: (eb) => eb.ref("customer_id"),
        pos_imunisasi_asik: (eb) => eb.ref("pos_imunisasi_asik"),
        vendor_id: (eb) => eb.ref("vendor_id"),
        puskesmas_asik: (eb) => eb.ref("puskesmas_asik"),
        material_id: (eb) => eb.ref("material_id"),
        vaksin_asik: (eb) => eb.ref("vaksin_asik"),
        batch_number_asik: (eb) => eb.ref("batch_number_asik"),
        batch_id_smile: (eb) => eb.ref("batch_id_smile"),
        batch_code_smile: (eb) => eb.ref("batch_code_smile"),
        injection_date: (eb) => eb.ref("injection_date"),
        aggregate: (eb) => eb.ref("aggregate"),
        input_date: (eb) => eb.ref("input_date"),
        pos_imunisasi_asik_province_id: (eb) => eb.ref("pos_imunisasi_asik_province_id"),
        pos_imunisasi_asik_regency_id: (eb) => eb.ref("pos_imunisasi_asik_regency_id"),
        pos_imunisasi_asik_subdistrict_id: (eb) => eb.ref("pos_imunisasi_asik_subdistrict_id"),
        puskesmas_asik_province_id: (eb) => eb.ref("puskesmas_asik_province_id"),
        puskesmas_asik_regency_id: (eb) => eb.ref("puskesmas_asik_regency_id"),
        puskesmas_asik_subdistrict_id: (eb) => eb.ref("puskesmas_asik_subdistrict_id"),
        page: (eb) => eb.ref("page"),
        updated_at: new Date(),
      })
      .execute()

    return asikAggregateData.length
  })
}