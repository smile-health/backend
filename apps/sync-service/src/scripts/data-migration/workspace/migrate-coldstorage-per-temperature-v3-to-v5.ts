import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const now = new Date()

function makeKey(coldstorageId, temperatureThresholdId, entityId) {
  return [coldstorageId, temperatureThresholdId, entityId].join("|")
}

async function mappingIds(fieldString, tableName, programId) {
  const mappingPlatforms = await syncDB
    .selectFrom(tableName)
    .select([
      "program_id",
      `platform_${fieldString}_id`,
      `existing_${fieldString}_id`,
    ])
    .where("program_id", "=", programId)
    .execute()

  const existingToPlatform = new Map<number, number>()
  for (const m of mappingPlatforms) {
    existingToPlatform.set(
      m[`existing_${fieldString}_id`],
      m[`platform_${fieldString}_id`]
    )
  }

  return existingToPlatform
}

export async function migrateColdstoragePerTemperatureV3ToV5(
  limit = CHUNK_SIZE,
  programId: number = 1,
  truncate: boolean = false
) {
  console.time("⏱️ Full migration start at")
  const migrationDb = getMigrationDB(programId)
  let offset = 0
  let totalInsert = 0
  let totalUpdate = 0
  let totalSkip = 0
  let totalFail = 0
  const coldstorageV5Ids = new Map<string, number>()

  // simpan hasil step truncate 2b
  let targetPlatformIds: number[] = []

  // simpan semua data v3
  const allColdstorageV3: any[] = []

  // ========================
  // TRUNCATE FLOW
  // ========================
  if (truncate) {
    console.log("🧹 Running truncate cleanup before migration...")

    try {
      const mappingsGrouped = await syncDB
        .selectFrom("mapping_coldstorage_per_temperatures")
        .select(["program_id", "platform_coldstorage_per_temperature_id"])
        .execute()

      if (mappingsGrouped.length > 0) {
        const platformIdToPrograms = new Map<number, Set<number>>()
        for (const m of mappingsGrouped) {
          const set =
            platformIdToPrograms.get(
              m.platform_coldstorage_per_temperature_id
            ) ?? new Set<number>()
          set.add(m.program_id)
          platformIdToPrograms.set(
            m.platform_coldstorage_per_temperature_id,
            set
          )
        }

        targetPlatformIds = Array.from(platformIdToPrograms.entries())
          .filter(
            ([_, progSet]) => progSet.size === 1 && progSet.has(programId)
          )
          .map(([id]) => id)

        console.log(
          `🧹 Found ${targetPlatformIds.length} platform IDs unique to programId=${programId}`
        )

        if (targetPlatformIds.length > 0) {
          await db
            .deleteFrom("coldstorage_per_temperature")
            .where("id", "in", targetPlatformIds)
            .execute()

          await resetIncrement(db, "coldstorage_per_temperature")
        }

        console.log("🧹 Truncate cleanup done, continue migration...")
      }
    } catch (err) {
      console.error("❌ Error during truncate cleanup:", err)
    }
  }

  // ========================
  // RANGE TEMPERATURE CHECK
  // ========================
  async function rangeTemperature() {
    const rangeTemperatures = await migrationDb
      .selectFrom("range_temperature")
      .select(["id", "temperature_min", "temperature_max"])
      .execute()

    const rangeTemperatureKeys = new Map<number, string>()
    for (const r of rangeTemperatures) {
      const key = [r.temperature_min, r.temperature_max].join("|")

      rangeTemperatureKeys.set(r.id, key)
    }

    return rangeTemperatureKeys
  }

  async function temperatureThreshold() {
    const rangeTemperatures = await db
      .selectFrom("temperature_thresholds")
      .select(["id", "min_temperature", "max_temperature"])
      .execute()

    const rangeTemperatureKeys = new Map<string, number>()
    for (const r of rangeTemperatures) {
      const key = [r.min_temperature, r.max_temperature].join("|")

      rangeTemperatureKeys.set(key, r.id)
    }

    return rangeTemperatureKeys
  }

  async function createNewTemperatureThresholds(rangeTemperatureKey: string) {
    const PREDEFINED_THRESHOLDS = new Set(["2|8", "-25|-15", "-86|-40"])
    const isPredefined = PREDEFINED_THRESHOLDS.has(rangeTemperatureKey) ? 1 : 0

    const [minTemperature, maxTemperature] = rangeTemperatureKey
      .split("|")
      .map(Number)

    const data = {
      min_temperature: minTemperature,
      max_temperature: maxTemperature,
      is_predefined: isPredefined,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const inserted = await db
      .insertInto("temperature_thresholds")
      .values(data)
      .executeTakeFirst()

    return Number(inserted.insertId)
  }

  async function getPlatformTemperatureThresholdId(
    rangeTemperatureId: number | null
  ) {
    if (rangeTemperatureId) {
      const key: string | null | undefined =
        rangeTemperatureSet.get(rangeTemperatureId)

      if (key) {
        const id: number | null | undefined = temperatureThresholdSet.get(key)

        if (id) {
          return id
        } else {
          const newId: number = await createNewTemperatureThresholds(key)
          return newId
        }
      } else {
        return null
      }
    } else {
      return null
    }
  }

  // ========================
  // PRE MAIN MIGRATION LOOP
  // ========================

  const entitySet = await mappingIds("entity", "mapping_entities", programId)

  const coldstorageSet = await mappingIds(
    "coldstorage",
    "mapping_coldstorages",
    programId
  )

  const rangeTemperatureSet = await rangeTemperature()

  const temperatureThresholdSet = await temperatureThreshold()

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    const coldstoragesV3: any = await migrationDb
      .selectFrom("coldstorage_per_temperature")
      .selectAll()
      .orderBy("id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (coldstoragesV3.length === 0) break

    const enrichedColdstoragesV3Raw = coldstoragesV3.map(async (m: any) => ({
      ...m,
      platform_coldstorage_id: m.coldstorage_id
        ? coldstorageSet.get(m.coldstorage_id)
        : null,
      platform_entity_id: m.entity_id ? entitySet.get(m.entity_id) : null,
      platform_temperature_threshold_id:
        await getPlatformTemperatureThresholdId(m.range_temperature_id),
    }))

    // tambahkan hasil query batch ini ke list besar
    const enrichedColdstoragesV3 = await Promise.all(enrichedColdstoragesV3Raw)

    allColdstorageV3.push(...enrichedColdstoragesV3)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      const existingV5 = await trx
        .selectFrom("coldstorage_per_temperature")
        .selectAll()
        .orderBy("id")
        .execute()

      const nameToV5Id = new Map<string, number>()
      for (const e of existingV5) {
        nameToV5Id.set(
          makeKey(e.coldstorage_id, e.temperature_threshold_id, e.entity_id),
          e.id
        )
        coldstorageV5Ids.set(
          makeKey(e.coldstorage_id, e.temperature_threshold_id, e.entity_id),
          e.id
        )
      }

      for (const m of enrichedColdstoragesV3) {
        try {
          if (
            m.platform_coldstorage_id &&
            m.platform_temperature_threshold_id &&
            m.platform_entity_id
          ) {
            const key = makeKey(
              m.platform_coldstorage_id,
              m.platform_temperature_threshold_id,
              m.platform_entity_id
            )
            if (!nameToV5Id.get(key)) {
              const inserted = await trx
                .insertInto("coldstorage_per_temperature")
                .values({
                  coldstorage_id: m.platform_coldstorage_id,
                  temperature_threshold_id: m.platform_temperature_threshold_id,
                  entity_id: m.platform_entity_id,
                  volume_asset: m.volume_asset,
                  total_volume: m.total_volume,
                  percentage_capacity: m.percentage_capacity,
                  projection_volume_asset: m.projection_volume_asset,
                  projection_total_volume: m.projection_total_volume,
                  projection_percentage_capacity:
                    m.projection_percentage_capacity,
                  created_at: m.created_at ? new Date(m.created_at) : now,
                  updated_at: m.updated_at ? new Date(m.updated_at) : now,
                  deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
                })
                .executeTakeFirst()

              if (inserted) {
                totalInsert += 1
                nameToV5Id.set(key, Number(inserted.insertId))
                coldstorageV5Ids.set(key, Number(inserted.insertId))
              }
            } else {
              await trx
                .updateTable("coldstorage_per_temperature")
                .set({
                  volume_asset: m.volume_asset,
                  total_volume: m.total_volume,
                  percentage_capacity: m.percentage_capacity,
                  projection_volume_asset: m.projection_volume_asset,
                  projection_total_volume: m.projection_total_volume,
                  projection_percentage_capacity:
                    m.projection_percentage_capacity,
                  created_at: m.created_at ? new Date(m.created_at) : now,
                  updated_at: m.updated_at ? new Date(m.updated_at) : now,
                  deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
                })
                .where("id", "=", Number(nameToV5Id.get(key)))
                .where("coldstorage_id", "=", m.platform_coldstorage_id)
                .where(
                  "temperature_threshold_id",
                  "=",
                  m.platform_temperature_threshold_id
                )
                .where("entity_id", "=", m.platform_entity_id)
                .execute()

              totalUpdate += 1
              coldstorageV5Ids.set(key, Number(nameToV5Id.get(key)))
            }
          } else {
            // skip, coldstorage id, entity id dan range temperature id tidak boleh null atau coldstorage id, entity id dan range temperature id 3.0 tidak ada di 5.0
            totalSkip += 1
            console.log(
              `Coldstorage per temperature ${m.id} cannot find coldstorage id ${m.coldstorage_id} or range temperature id ${m.range_temperature_id} or entity_id ${m.entity_id} in 5.0 or coldstorage id or range temperature id or entity id is null`
            )
            continue
          }
        } catch (err) {
          totalFail += 1
          console.error(
            "❌ Failed inserting coldstorage per temperature:",
            m.id,
            err
          )
        }
      }
    }) // end trx

    offset += limit
  } // end while

  // ========================
  // FINAL TRUNCATE STEP (hapus mapping)
  // ========================
  if (truncate && targetPlatformIds.length > 0) {
    console.log(
      `🧹 Final truncate step: deleting mapping for ${targetPlatformIds} platform IDs`
    )
    await syncDB
      .deleteFrom("mapping_coldstorage_per_temperatures")
      .where("platform_coldstorage_per_temperature_id", "in", targetPlatformIds)
      .where("program_id", "=", programId)
      .execute()

    await resetIncrement(syncDB, "mapping_coldstorage_per_temperatures")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================
  for (const v3 of allColdstorageV3) {
    const key = makeKey(
      v3.platform_coldstorage_id,
      v3.platform_temperature_threshold_id,
      v3.platform_entity_id
    )
    const newV5Id = coldstorageV5Ids.get(key)
    if (!newV5Id) continue

    const exists = await syncDB
      .selectFrom("mapping_coldstorage_per_temperatures")
      .select("id")
      .where("program_id", "=", programId)
      .where("platform_coldstorage_per_temperature_id", "=", newV5Id)
      .where("existing_coldstorage_per_temperature_id", "=", v3.id)
      .executeTakeFirst()

    if (!exists) {
      await syncDB
        .insertInto("mapping_coldstorage_per_temperatures")
        .values({
          program_id: programId,
          platform_coldstorage_per_temperature_id: newV5Id,
          existing_coldstorage_per_temperature_id: v3.id,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  console.timeEnd("⏱️ Full migration end at")
  console.log(`Total migrated rows inserted: ${totalInsert}`)
  console.log(`Total migrated rows updated: ${totalUpdate}`)
  console.log(`Total migrated has skipped: ${totalSkip}`)
  console.log(`Total migrated has failed: ${totalFail}`)
}
