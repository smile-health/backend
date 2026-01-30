import { collect } from "@smile-health/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMigrationDB } from "../../../db.migration.js"
import { db } from "../../../db.platform.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"

export const migrateEmonevRegenciesUpdated = async (
  batchSize: number,
  programId = 1
) => {
  const startTime = new Date()
  console.info(`Migration Emonev Regencies Updated started at: ${startTime.toLocaleString()}`)
  
  const migrationDB = getMigrationDB(programId)
  
  let totalCount = 0
  let page = 0
  
  try {
    while (true) {
      const rows = await migrationDB
        .selectFrom("integration_emonev_regencies_updated as ieru")
        .select(["ieru.id"])
        .orderBy("ieru.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      
      const regencyUpdatedIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const count = await doMigrateEmonevRegenciesUpdated(trx, migrationDB, regencyUpdatedIds)
        totalCount += count
      })

      page++
      console.log(`Emonev Regencies Updated batch ${page} completed (${rows.length} records)`);
    }

    console.info(`✅ Emonev Regencies Updated migration completed: ${totalCount} records`)
    return { count: totalCount }
  } catch (error) {
    console.error("❌ Emonev Regencies Updated migration failed")
    console.error(error)
    throw error
  }
}

export const doMigrateEmonevRegenciesUpdated = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  regencyUpdatedIds: number[]
) => {
  const regenciesUpdated = await migrationDB
    .selectFrom("integration_emonev_regencies_updated as ieru")
    .selectAll()
    .where("ieru.id", "in", regencyUpdatedIds)
    .execute()

  if (regenciesUpdated.length === 0) {
    return 0
  }

  const insertData = regenciesUpdated.map((regency) => ({
    id: regency.id,
    regency_id: regency.regency_id,
    bps_regency_id: regency.bps_regency_id,
    trader_id: regency.trader_id,
    code: regency.code,
    name: regency.name,
    npwp: regency.npwp,
    permit: regency.permit,
    permit_date: regency.permit_date,
    pic: regency.pic,
    pic_email: regency.pic_email,
    pic_phone: regency.pic_phone,
    pimpinan: regency.pimpinan,
    pimpinan_phone: regency.pimpinan_phone,
    pimpinan_email: regency.pimpinan_email,
    created_at: regency.created_at,
    updated_at: regency.updated_at,
  }))

  await trx
    .insertInto("integration_emonev_regencies_updated")
    .values(insertData)
    .onDuplicateKeyUpdate({
      regency_id: (eb) => eb.ref("regency_id"),
      bps_regency_id: (eb) => eb.ref("bps_regency_id"),
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

  return regenciesUpdated.length
}