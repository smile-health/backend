import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const now = new Date()

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

export async function migrateColdstorageV3ToV5(
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
  const coldstorageV5Ids = new Map<number, number>()

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
        .selectFrom("mapping_coldstorages")
        .select(["program_id", "platform_coldstorage_id"])
        .execute()

      if (mappingsGrouped.length > 0) {
        const platformIdToPrograms = new Map<number, Set<number>>()
        for (const m of mappingsGrouped) {
          const set =
            platformIdToPrograms.get(m.platform_coldstorage_id) ??
            new Set<number>()
          set.add(m.program_id)
          platformIdToPrograms.set(m.platform_coldstorage_id, set)
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
            .deleteFrom("coldstorages")
            .where("id", "in", targetPlatformIds)
            .execute()

          await resetIncrement(db, "coldstorages")
        }

        console.log("🧹 Truncate cleanup done, continue migration...")
      }
    } catch (err) {
      console.error("❌ Error during truncate cleanup:", err)
    }
  }

  // ========================
  // PRE MAIN MIGRATION LOOP
  // ========================

  const entitySet = await mappingIds("entity", "mapping_entities", programId)

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    const coldstoragesV3: any = await migrationDb
      .selectFrom("coldstorages")
      .selectAll()
      .orderBy("id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (coldstoragesV3.length === 0) break

    const enrichedColdstoragesV3Raw = coldstoragesV3.map(async (m: any) => ({
      ...m,
      platform_entity_id: m.entity_id ? entitySet.get(m.entity_id) : null,
    }))

    // tambahkan hasil query batch ini ke list besar
    const enrichedColdstoragesV3 = await Promise.all(enrichedColdstoragesV3Raw)

    allColdstorageV3.push(...enrichedColdstoragesV3)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      const existingV5 = await trx
        .selectFrom("coldstorages")
        .selectAll()
        .orderBy("id")
        .execute()

      const nameToV5Id = new Map<number, number>()
      for (const e of existingV5) {
        nameToV5Id.set(e.entity_id, e.id)
        coldstorageV5Ids.set(e.entity_id, e.id)
      }

      for (const m of enrichedColdstoragesV3) {
        try {
          if (m.platform_entity_id) {
            if (!nameToV5Id.get(m.platform_entity_id)) {
              const inserted = await trx
                .insertInto("coldstorages")
                .values({
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
                nameToV5Id.set(m.platform_entity_id, Number(inserted.insertId))
                coldstorageV5Ids.set(
                  m.platform_entity_id,
                  Number(inserted.insertId)
                )
              }
            } else {
              await trx
                .updateTable("coldstorages")
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
                .where("id", "=", Number(nameToV5Id.get(m.platform_entity_id)))
                .where("entity_id", "=", m.platform_entity_id)
                .execute()

              totalUpdate += 1
              coldstorageV5Ids.set(
                m.platform_entity_id,
                Number(nameToV5Id.get(m.platform_entity_id))
              )
            }
          } else {
            // skip, entity id tidak boleh null atau entity id 3.0 tidak ada di 5.0
            totalSkip += 1
            console.log(
              `Coldstorage ${m.id} cannot find entity id ${m.entity_id} in 5.0 or entity id is null`
            )
            continue
          }
        } catch (err) {
          totalFail += 1
          console.error(
            "❌ Failed inserting or updating coldstorages:",
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
      .deleteFrom("mapping_coldstorages")
      .where("platform_coldstorage_id", "in", targetPlatformIds)
      .where("program_id", "=", programId)
      .execute()

    await resetIncrement(syncDB, "mapping_coldstorages")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================
  for (const v3 of allColdstorageV3) {
    const newV5Id = coldstorageV5Ids.get(v3.platform_entity_id)
    if (!newV5Id) continue

    const exists = await syncDB
      .selectFrom("mapping_coldstorages")
      .select("id")
      .where("program_id", "=", programId)
      .where("platform_coldstorage_id", "=", newV5Id)
      .where("existing_coldstorage_id", "=", v3.id)
      .executeTakeFirst()

    if (!exists) {
      await syncDB
        .insertInto("mapping_coldstorages")
        .values({
          program_id: programId,
          platform_coldstorage_id: newV5Id,
          existing_coldstorage_id: v3.id,
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
