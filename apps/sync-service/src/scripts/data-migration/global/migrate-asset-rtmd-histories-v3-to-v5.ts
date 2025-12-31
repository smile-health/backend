import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration_iot_new.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const now = new Date()

async function mappingAssetsIds(type, programId) {
  const mappingPlatforms = await syncDB
    .selectFrom("mapping_assets")
    .select(["program_id", "platform_asset_id", "existing_asset_id"])
    .where("program_id", "=", programId)
    .where("existing_source_type", "=", type)
    .execute()

  const existingToPlatform = new Map<number, number>()
  for (const m of mappingPlatforms) {
    existingToPlatform.set(m.existing_asset_id, m.platform_asset_id)
  }

  return existingToPlatform
}

async function mappingAssetInventoryRtmd() {
  const assetInventoryRtmds = await db
    .selectFrom("asset_inventory_rtmds")
    .select(["asset_rtmd_id", "asset_inventory_id"])
    .execute()

  const existingToPlatform = new Map<number, number>()
  for (const m of assetInventoryRtmds) {
    existingToPlatform.set(m.asset_rtmd_id, m.asset_inventory_id)
  }

  return existingToPlatform
}

async function mappingAssetTypeByInventory() {
  const assetInventories = await db
    .selectFrom("asset_inventories")
    .select(["id", "asset_type_id"])
    .where("asset_type_id", "is not", null)
    .execute()

  const existingToPlatform = new Map<number, number | null>()
  for (const m of assetInventories) {
    existingToPlatform.set(m.id, m.asset_type_id)
  }

  return existingToPlatform
}

async function mappingAssetModelByInventory() {
  const assetInventories = await db
    .selectFrom("asset_inventories")
    .select(["id", "asset_model_id"])
    .where("asset_model_id", "is not", null)
    .execute()

  const existingToPlatform = new Map<number, number | null>()
  for (const m of assetInventories) {
    existingToPlatform.set(m.id, m.asset_model_id)
  }

  return existingToPlatform
}

function selectPlatformIds(mappingsGrouped, programId) {
  // group platform_logger_history_id -> set(program_id)
  const platformIdToPrograms = new Map<number, Set<number>>()
  for (const m of mappingsGrouped) {
    const set =
      platformIdToPrograms.get(m.platform_logger_history_id) ??
      new Set<number>()
    set.add(m.program_id)
    platformIdToPrograms.set(m.platform_logger_history_id, set)
  }

  // pilih platform IDs yang hanya ada pada programId
  const targetPlatformIds = Array.from(platformIdToPrograms.entries())
    .filter(([_, progSet]) => progSet.size === 1 && progSet.has(programId))
    .map(([id]) => id)

  return targetPlatformIds
}

async function selectionTemperatureId() {
  const assetTypes = await getMigrationDB()
    .selectFrom("asset_type")
    .select(["id"])
    .where("is_coldstorage", "=", 1)
    .where("deleted_at", "is", null)
    .execute()

  const existingAsseTypeIds = assetTypes.map((v3) => v3.id)

  const mappingAssetTypes = await syncDB
    .selectFrom("mapping_asset_types")
    .select("platform_asset_type_id")
    .where("existing_asset_type_id", "in", existingAsseTypeIds)
    .execute()

  const platformAsseTypeIds = mappingAssetTypes.map(
    (v5) => v5.platform_asset_type_id
  )

  const types = await db
    .selectFrom("asset_types_temperatures as att")
    .leftJoin("temperature_thresholds as tt", (join) =>
      join.onRef("att.temperature_threshold_id", "=", "tt.id")
    )
    .leftJoin("asset_models_temperatures_capacities as amtc", (join) =>
      join.onRef("att.id", "=", "amtc.asset_type_temperature_id")
    )
    .select([
      "amtc.id as id",
      "att.asset_type_id",
      "amtc.asset_model_id",
      "tt.min_temperature",
      "tt.max_temperature",
    ])
    .where("att.asset_type_id", "in", platformAsseTypeIds)
    .execute()

  const rangeTemperatureUsedIds = new Map<string, number>()
  for (const m of types) {
    rangeTemperatureUsedIds.set(
      [
        m.asset_type_id ?? null,
        m.asset_model_id ?? null,
        m.min_temperature ?? null,
        m.max_temperature ?? null,
      ].join("|"),
      Number(m.id)
    )
  }

  return rangeTemperatureUsedIds
}

function normalizeKey(str) {
  return str.toLowerCase().replace(/\s+/g, "")
}

function workingStatus(status) {
  const WORKING_STATUS = {
    berfungsi: 1,
    standby: 2,
    dalamperbaikan: 3,
    rusak: 4,
    perluperbaikan: 5,
    sudahdibuang: 6,
  }

  const result = WORKING_STATUS[normalizeKey(status)] ?? null

  return result
}

function loggerStatus(status) {
  const LOGGER_STATUS = {
    aktif: 1,
    tidakaktif: 2,
    tidakberlangganan: 3,
  }

  const result = LOGGER_STATUS[normalizeKey(status)] ?? null

  return result
}

export async function migrateAssetRtmdHistoriesV3ToV5(
  limit = CHUNK_SIZE,
  startId: number = 1,
  programId: number = 1,
  truncate: boolean = true
) {
  console.time("⏱️ Full migration start at")
  const migrationDb = getMigrationDB()
  let offset = 0
  let total = 0
  let totalMigration = 0
  let totalMapping = 0
  const historiesV5Ids = new Map<number, number>()

  // simpan hasil step truncate
  let targetHistoriesPlatformIds: number[] = []

  // simpan semua data v3
  const allHistoriesV3: any[] = []

  // ========================
  // TRUNCATE FLOW
  // ========================
  if (truncate) {
    console.log("🧹 Running truncate cleanup before migration...")

    try {
      // ambil semua mapping (program_id + platform_logger_history_id)
      const mappingsGrouped = await syncDB
        .selectFrom("mapping_logger_histories")
        .select(["program_id", "platform_logger_history_id"])
        .execute()

      if (mappingsGrouped.length > 0) {
        targetHistoriesPlatformIds = selectPlatformIds(
          mappingsGrouped,
          programId
        )

        console.log(
          `🧹 Found ${targetHistoriesPlatformIds.length} asset inventory platform IDs unique to programId=${programId}`
        )

        if (targetHistoriesPlatformIds.length > 0) {
          await db
            .deleteFrom("asset_rtmd_histories")
            .where("id", "in", targetHistoriesPlatformIds)
            .execute()

          await resetIncrement(db, "asset_rtmd_histories")
        }
      }
      console.log("🧹 Truncate cleanup done, continue migration...")
    } catch (err) {
      console.error("❌ Error during truncate cleanup:", err)
    }
  }

  // ========================
  // PRE MAIN MIGRATION LOOP
  // ========================

  // proses mapping platform ke logger histories v3
  const assetSet = await mappingAssetsIds("rtmd", programId)

  const assetInventoryRtmdSet = await mappingAssetInventoryRtmd()

  const assetTypeByInventorySet = await mappingAssetTypeByInventory()

  const assetModelByInventorySet = await mappingAssetModelByInventory()

  const opsSelectionTemperatureSet = await selectionTemperatureId()

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    const historiesV3 = await migrationDb
      .selectFrom("logger_histories as lh")
      .select([
        "lh.id",
        "lh.asset_id",
        "lh.temp as temperature",
        "lh.working_status",
        "lh.logger_status",
        "lh.status_device as device_status",
        "lh.actual_date",
        "lh.lat as latitude",
        "lh.long as longitude",
        "lh.battery",
        "lh.signal",
        "lh.power as is_power_connected",
        "lh.humidity",
        "lh.max_temp",
        "lh.min_temp",
        "lh.created_at",
        "lh.updated_at",
        "lh.deleted_at",
      ])
      .orderBy("lh.id")
      .limit(limit)
      .offset(offset)
      .execute()

    total += limit

    if (historiesV3.length === 0) break

    const enrichedHistories = historiesV3.map(async (m) => ({
      ...m,
      asset_rtmd_id: m.asset_id ? assetSet.get(m.asset_id) : null,
      inventory_working_status_id: m.working_status
        ? workingStatus(m.working_status)
        : null,
      rtmd_status_id: m.logger_status ? loggerStatus(m.logger_status) : null,
      actual_time: m.actual_date ? new Date(m.actual_date) : now,
      asset_model_temperature_capacity_id: m.asset_id
        ? (opsSelectionTemperatureSet.get(
            [
              assetSet.get(m.asset_id)
                ? assetInventoryRtmdSet.get(Number(assetSet.get(m.asset_id)))
                  ? assetTypeByInventorySet.get(
                      Number(
                        assetInventoryRtmdSet.get(
                          Number(assetSet.get(m.asset_id))
                        )
                      )
                    )
                  : null
                : null,
              assetSet.get(m.asset_id)
                ? assetInventoryRtmdSet.get(Number(assetSet.get(m.asset_id)))
                  ? assetModelByInventorySet.get(
                      Number(
                        assetInventoryRtmdSet.get(
                          Number(assetSet.get(m.asset_id))
                        )
                      )
                    )
                  : null
                : null,
              m.min_temp ?? null,
              m.max_temp ?? null,
            ].join("|")
          ) ?? null)
        : null,
    }))

    const enrichedHistoriesResolved = await Promise.all(enrichedHistories)

    allHistoriesV3.push(...enrichedHistoriesResolved)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      const bulkHistories: any[] = []

      if (enrichedHistoriesResolved.length > 0) {
        for (const m of enrichedHistoriesResolved) {
          if (m.asset_rtmd_id != null) {
            totalMigration += 1
            const data = {
              id: startId,
              asset_rtmd_id: m.asset_rtmd_id,
              inventory_working_status_id: m.inventory_working_status_id,
              rtmd_status_id: m.rtmd_status_id,
              actual_time: m.actual_time,
              temperature: m.temperature,
              device_status: m.device_status,
              latitude: m.latitude,
              longitude: m.longitude,
              battery: m.battery,
              signal: m.signal,
              is_power_connected: m.is_power_connected,
              humidity: m.humidity,
              asset_model_temperature_capacity_id:
                m.asset_model_temperature_capacity_id,
              created_at: m.created_at ? new Date(m.created_at) : now,
              updated_at: m.updated_at ? new Date(m.updated_at) : now,
              deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
            }
            historiesV5Ids.set(m.id, startId)
            bulkHistories.push(data)
            startId += 1
          }
        }
        if (bulkHistories.length > 0) {
          await trx
            .insertInto("asset_rtmd_histories")
            .values(bulkHistories)
            .execute()
        }
      }
    }) // end trx
    offset += limit
  } // end while

  // ========================
  // FINAL TRUNCATE STEP (hapus mapping)
  // ========================
  if (truncate) {
    if (targetHistoriesPlatformIds.length > 0) {
      console.log(
        `🧹 Final truncate step: deleting mapping for ${targetHistoriesPlatformIds} platform IDs`
      )
      await syncDB
        .deleteFrom("mapping_logger_histories")
        .where("platform_logger_history_id", "in", targetHistoriesPlatformIds)
        .where("program_id", "=", programId)
        // .where("existing_source_type", "=", "asset_inventory")
        .execute()
    }

    await resetIncrement(syncDB, "mapping_logger_histories")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================

  let offsetMapping = 0

  while (offsetMapping < allHistoriesV3.length) {
    const mappingNewLoggerHistories: any[] = []

    const limitedHistories = allHistoriesV3.slice(
      offsetMapping,
      offsetMapping + limit
    )

    // `platform_logger_history_id` dianggap sebagai data global karena berada di global
    for (const v3 of limitedHistories) {
      const historiesNewV5Id = historiesV5Ids.get(v3.id)
      if (!historiesNewV5Id) continue
      totalMapping += 1

      mappingNewLoggerHistories.push({
        program_id: programId,
        platform_logger_history_id: historiesNewV5Id,
        existing_logger_history_id: v3.id,
        created_at: now,
        updated_at: now,
      })
    }

    if (mappingNewLoggerHistories.length > 0) {
      await syncDB
        .insertInto("mapping_logger_histories")
        .values(mappingNewLoggerHistories)
        .execute()
    }
    offsetMapping += limit
  }

  console.timeEnd("⏱️ Full migration end at")
  console.log(`total query all from v3: ${total}`)
  console.log(
    `Total logger histories migrated rows processed: ${totalMigration}`
  )
  console.log(
    `Total mapping logger histories migrated rows processed: ${totalMapping}`
  )
}
