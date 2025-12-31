import { collect } from "@smile/lib/utils.js"
import { Kysely, Transaction } from "kysely"
import { getMigrationDB } from "../../../db.migration_iot.js"
import { db } from "../../../db.platform.js"
import { MigrationDB } from "../../../types.js"
import { DB } from "../../../types.platform.js"
import { getMapUserIds, getMapEntityIds, getMapAssetIds } from "../../../helper.js"

export const migrateLoggerHistories = async (
  batchSize: number,
  programId = 1
) => {
  const startTime = new Date()
  const startTimestamp = Date.now()
  console.info(`Migration Logger Histories started at: ${startTime.toLocaleString()}`)
  
  const migrationDB = getMigrationDB(programId)
  
  let totalCount = 0
  let page = 0
  
  try {
    while (true) {
      const batchStartTime = Date.now()
      
      const rows = await migrationDB
        .selectFrom("logger_histories as lh")
        .select(["lh.id"])
        .orderBy("lh.id")
        .limit(batchSize)
        .offset(page * batchSize)
        .execute()

      if (rows.length === 0) {
        break
      }
      
      const loggerIds = collect(rows, "id")

      await db.transaction().execute(async (trx) => {
        const count = await doMigrateLoggerHistories(trx, migrationDB, loggerIds, programId)
        totalCount += count
      })

      page++
      const batchDuration = Date.now() - batchStartTime
      console.log(`Logger Histories batch ${page} completed (${rows.length} records) - Duration: ${batchDuration}ms`);
    }

    const finishTime = new Date()
    const totalDuration = Date.now() - startTimestamp
    const durationMinutes = (totalDuration / 1000 / 60).toFixed(2)
    
    console.info(`✅ Logger Histories migration completed: ${totalCount} records`)
    console.info(`Started at: ${startTime.toLocaleString()}`)
    console.info(`Finished at: ${finishTime.toLocaleString()}`)
    console.info(`Total duration: ${totalDuration}ms (${durationMinutes} minutes)`)
    
    process.exit(0)
  } catch (error) {
    const errorTime = new Date()
    const errorDuration = Date.now() - startTimestamp
    console.error("❌ Logger Histories migration failed")
    console.error(`Failed at: ${errorTime.toLocaleString()}`)
    console.error(`Duration before failure: ${errorDuration}ms`)
    console.error(error)
    process.exit(1)
  }
}

export const doMigrateLoggerHistories = async (
  trx: Transaction<DB>,
  migrationDB: Kysely<MigrationDB>,
  loggerIds: number[],
  programId = 1
) => {
  const batchProcessStartTime = Date.now()
  console.log(`Processing ${loggerIds.length} logger history records...`)
  
  const loggerHistories = await migrationDB
    .selectFrom("logger_histories as lh")
    .select([
      "lh.device_code",
      "lh.temp",
      "lh.status",
      "lh.entity_id",
      "lh.deleted_at",
      "lh.created_at",
      "lh.updated_at",
      "lh.asset_id",
      "lh.lat",
      "lh.long",
      "lh.actual_date",
      "lh.status_device",
      "lh.battery",
      "lh.signal",
      "lh.power",
      "lh.working_status",
      "lh.max_temp",
      "lh.min_temp",
      "lh.logger_status",
      "lh.humidity",
    ])
    .where("lh.id", "in", loggerIds)
    .execute()
  
  // Get unique IDs and map them
  const entityIds = [...new Set(loggerHistories.map(h => h.entity_id).filter(Boolean))]
  const assetIds = [...new Set(loggerHistories.map(h => h.asset_id).filter(Boolean))]
  
  const [entityIdMap, assetIdMap] = await Promise.all([
    getMapEntityIds(programId, entityIds),
    getMapAssetIds(programId, assetIds)
  ])
  
  if (loggerHistories.length === 0) {
    return 0
  }

  // Transform and insert into ws_logger_histories table
  const insertData = loggerHistories.map(history => ({
    device_code: history.device_code,
    temp: history.temp,
    status: history.status,
    entity_id: history.entity_id ? entityIdMap[history.entity_id] || null : null,
    asset_id: history.asset_id ? assetIdMap[history.asset_id] || null : null,
    lat: history.lat || 0.0,
    long: history.long || 0.0,
    actual_date: history.actual_date,
    status_device: Boolean(history.status_device),
    battery: history.battery || 0.0,
    signal: history.signal || 0.0,
    power: Boolean(history.power),
    working_status: history.working_status,
    max_temp: history.max_temp,
    min_temp: history.min_temp,
    logger_status: history.logger_status,
    humidity: history.humidity,
    created_at: history.created_at || new Date(),
    updated_at: history.updated_at || new Date()
  }))

  await trx
    .insertInto("ws_logger_histories")
    .values(insertData)
    .onDuplicateKeyUpdate({
      temp: (eb) => eb.ref("temp"),
      status: (eb) => eb.ref("status"),
      entity_id: (eb) => eb.ref("entity_id"),
      asset_id: (eb) => eb.ref("asset_id"),
      lat: (eb) => eb.ref("lat"),
      long: (eb) => eb.ref("long"),
      actual_date: (eb) => eb.ref("actual_date"),
      status_device: (eb) => eb.ref("status_device"),
      battery: (eb) => eb.ref("battery"),
      signal: (eb) => eb.ref("signal"),
      power: (eb) => eb.ref("power"),
      working_status: (eb) => eb.ref("working_status"),
      max_temp: (eb) => eb.ref("max_temp"),
      min_temp: (eb) => eb.ref("min_temp"),
      logger_status: (eb) => eb.ref("logger_status"),
      humidity: (eb) => eb.ref("humidity"),
      updated_at: (eb) => eb.ref("updated_at")
    })
    .execute()

  const batchProcessDuration = Date.now() - batchProcessStartTime
  console.log(`Batch processing completed in ${batchProcessDuration}ms`)

  return loggerHistories.length
}