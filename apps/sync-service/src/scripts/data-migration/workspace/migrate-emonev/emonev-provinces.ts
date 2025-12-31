import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateEmonevProvinces = async (
  batchSize: number,
  programId = 1
) => {
  const startTime = new Date()
  console.info(`Migration Emonev Provinces started at: ${startTime.toLocaleString()}`)
  
  const migrationDB = getMigrationDB(programId)
  
  let totalCount = 0
  let page = 0
  
  try {
    while (true) {
      const rows = await migrationDB
        .selectFrom("integration_emonev_provinces as iep")
        .select(["iep.id"])
        .orderBy("iep.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      
      const provinceIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const count = await doMigrateEmonevProvinces(trx, migrationDB, provinceIds)
        totalCount += count
      })

      page++
      console.log(`Emonev Provinces batch ${page} completed (${rows.length} records)`);
    }

    console.info(`✅ Emonev Provinces migration completed: ${totalCount} records`)
    return { count: totalCount }
  } catch (error) {
    console.error("❌ Emonev Provinces migration failed")
    console.error(error)
    throw error
  }
}

export const doMigrateEmonevProvinces = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  provinceIds: number[]
) => {
  const provinces = await migrationDB
    .selectFrom("integration_emonev_provinces as iep")
    .selectAll()
    .where("iep.id", "in", provinceIds)
    .execute()

  if (provinces.length === 0) {
    return 0
  }

  const insertData = provinces.map((province) => ({
    id: province.id,
    province_id: province.province_id,
    trader_id: province.trader_id,
    code: province.code,
    name: province.name,
    npwp: province.npwp,
    permit: province.permit,
    permit_date: province.permit_date,
    pic: province.pic,
    pic_email: province.pic_email,
    pic_phone: province.pic_phone,
    pimpinan: province.pimpinan,
    pimpinan_phone: province.pimpinan_phone,
    pimpinan_email: province.pimpinan_email,
    created_at: province.created_at,
    updated_at: province.updated_at,
  }))

  await trx
    .insertInto("integration_emonev_provinces")
    .values(insertData)
    .onDuplicateKeyUpdate({
      province_id: (eb) => eb.ref("province_id"),
      trader_id: (eb) => eb.ref("trader_id"),
      code: (eb) => eb.ref("code"),
      name: (eb) => eb.ref("name"),
      npwp: (eb) => eb.ref("npwp"),
      permit: (eb) => eb.ref("permit"),
      permit_date: (eb) => eb.ref("permit_date"),
      pic: (eb) => eb.ref("pic"),
      pic_email: (eb) => eb.ref("pic_email"),
      pic_phone: (eb) => eb.ref("pic_phone"),
      pimpinan: (eb) => eb.ref("pimpinan"),
      pimpinan_phone: (eb) => eb.ref("pimpinan_phone"),
      pimpinan_email: (eb) => eb.ref("pimpinan_email"),
      updated_at: (eb) => eb.ref("updated_at"),
    })
    .execute()

  return provinces.length
}