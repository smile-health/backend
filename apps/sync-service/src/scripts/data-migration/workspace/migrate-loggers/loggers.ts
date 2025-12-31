import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMigrationDB } from "../../../db.migration_iot.js"
import { db } from "../../../db.platform.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"
import { getMapAssetIds } from "../../../helper.js"

export const migrateLoggers = async (
  batchSize: number,
  programId = 1
) => {
  const startTime = new Date()
  const startTimestamp = Date.now()
  console.info(`Migration Loggers started at: ${startTime.toLocaleString()}`)
  
  const migrationDB = getMigrationDB(programId)
  
  let totalCount = 0
  let page = 0
  
  try {
    while (true) {
      const batchStartTime = Date.now()
      
      const rows = await migrationDB
        .selectFrom("loggers as l")
        .select(["l.id"])
        .orderBy("l.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      
      const loggerIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const count = await doMigrateLoggers(trx, migrationDB, loggerIds, programId)
        totalCount += count
      })

      page++
      const batchDuration = Date.now() - batchStartTime
      console.log(`Loggers batch ${page} completed (${rows.length} records) - Duration: ${batchDuration}ms`);
    }

    const finishTime = new Date()
    const totalDuration = Date.now() - startTimestamp
    const durationMinutes = (totalDuration / 1000 / 60).toFixed(2)
    
    console.info(`✅ Loggers migration completed: ${totalCount} records`)
    console.info(`Started at: ${startTime.toLocaleString()}`)
    console.info(`Finished at: ${finishTime.toLocaleString()}`)
    console.info(`Total duration: ${totalDuration}ms (${durationMinutes} minutes)`)

    process.exit(0)
  } catch (error) {
    const errorTime = new Date()
    const errorDuration = Date.now() - startTimestamp
    console.error("❌ Loggers migration failed")
    console.error(`Failed at: ${errorTime.toLocaleString()}`)
    console.error(`Duration before failure: ${errorDuration}ms`)
    console.error(error)
    process.exit(1)
  }
}

export const doMigrateLoggers = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  loggerIds: number[],
  programId = 1
) => {
  const batchProcessStartTime = Date.now()
  console.log(`Processing ${loggerIds.length} logger records...`)
  
  const loggers = await migrationDB
    .selectFrom("loggers as l")
    .select([
      "l.id",
      "l.serial_number",
      "l.gsm_no",
      "l.location",
      "l.vendor",
      "l.asset_id",
      "l.position",
      "l.min",
      "l.max",
      "l.temp",
      "l.status",
      "l.prod_year",
      "l.created_at",
      "l.updated_at",
    ])
    .where("l.id", "in", loggerIds)
    .execute()
  
  // Get unique asset IDs and map them
  const assetIds = [...new Set(loggers.map(l => l.asset_id).filter(Boolean))]
  
  const assetIdMap = await getMapAssetIds(programId, assetIds)
  
  if (loggers.length === 0) {
    return 0
  }

  // Transform and insert into ws_loggers table
  const insertData = loggers.map(logger => ({
    serial_number: logger.serial_number,
    gsm_no: logger.gsm_no,
    location: logger.location,
    vendor: logger.vendor,
    asset_id: logger.asset_id ? assetIdMap[logger.asset_id] || null : null,
    position: logger.position,
    min: logger.min || 0,
    max: logger.max || 0,
    temp: logger.temp || '0.0',
    status: logger.status || 1,
    prod_year: logger.prod_year || '1990',
    created_at: logger.created_at || new Date(),
    updated_at: logger.updated_at || new Date()
  }))

  await trx
    .insertInto("ws_loggers")
    .values(insertData)
    .onDuplicateKeyUpdate({
      serial_number: (eb) => eb.ref("serial_number"),
      gsm_no: (eb) => eb.ref("gsm_no"),
      location: (eb) => eb.ref("location"),
      vendor: (eb) => eb.ref("vendor"),
      asset_id: (eb) => eb.ref("asset_id"),
      position: (eb) => eb.ref("position"),
      min: (eb) => eb.ref("min"),
      max: (eb) => eb.ref("max"),
      temp: (eb) => eb.ref("temp"),
      status: (eb) => eb.ref("status"),
      prod_year: (eb) => eb.ref("prod_year"),
      updated_at: (eb) => eb.ref("updated_at")
    })
    .execute()

  const batchProcessDuration = Date.now() - batchProcessStartTime
  console.log(`Batch processing completed in ${batchProcessDuration}ms`)

  return loggers.length
}