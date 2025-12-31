import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const now = new Date()

function makeKey(coldstorageId, materialId, entityId) {
  return [coldstorageId, materialId, entityId].join("|")
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

export async function migrateColdstorageMaterialV3ToV5(
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
        .selectFrom("mapping_coldstorage_materials")
        .select(["program_id", "platform_coldstorage_material_id"])
        .execute()

      if (mappingsGrouped.length > 0) {
        const platformIdToPrograms = new Map<number, Set<number>>()
        for (const m of mappingsGrouped) {
          const set =
            platformIdToPrograms.get(m.platform_coldstorage_material_id) ??
            new Set<number>()
          set.add(m.program_id)
          platformIdToPrograms.set(m.platform_coldstorage_material_id, set)
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
            .deleteFrom("coldstorage_materials")
            .where("id", "in", targetPlatformIds)
            .execute()

          await resetIncrement(db, "coldstorage_materials")
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

  const materialSet = await mappingIds(
    "material",
    "mapping_materials",
    programId
  )

  const coldstorageSet = await mappingIds(
    "coldstorage",
    "mapping_coldstorages",
    programId
  )

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    const coldstoragesV3: any = await migrationDb
      .selectFrom("coldstorage_materials")
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
      platform_material_id: m.master_material_id
        ? materialSet.get(m.master_material_id)
        : null,
      platform_entity_id: m.entity_id ? entitySet.get(m.entity_id) : null,
    }))

    // tambahkan hasil query batch ini ke list besar
    const enrichedColdstoragesV3 = await Promise.all(enrichedColdstoragesV3Raw)

    allColdstorageV3.push(...enrichedColdstoragesV3)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      const existingV5 = await trx
        .selectFrom("coldstorage_materials")
        .selectAll()
        .orderBy("id")
        .execute()

      const nameToV5Id = new Map<string, number>()
      for (const e of existingV5) {
        nameToV5Id.set(
          makeKey(e.coldstorage_id, e.material_id, e.entity_id),
          e.id
        )
        coldstorageV5Ids.set(
          makeKey(e.coldstorage_id, e.material_id, e.entity_id),
          e.id
        )
      }

      for (const m of enrichedColdstoragesV3) {
        try {
          if (
            m.platform_coldstorage_id &&
            m.platform_material_id &&
            m.platform_entity_id
          ) {
            const key = makeKey(
              m.platform_coldstorage_id,
              m.platform_material_id,
              m.platform_entity_id
            )
            // console.log(`key awalan: ${key}`)
            // console.log(`id awalan: ${m.id}`)
            // console.log(`material id 3.0 awalan: ${m.master_material_id}`)
            // console.log(`material id 5.0 awalan: ${m.platform_material_id}`)
            if (!nameToV5Id.get(key)) {
              // console.log(`key insertan: ${key}`)
              // console.log(`id insertan: ${m.id}`)
              const inserted = await trx
                .insertInto("coldstorage_materials")
                .values({
                  coldstorage_id: m.platform_coldstorage_id,
                  material_id: m.platform_material_id,
                  entity_id: m.platform_entity_id,
                  dosage_stock: m.dosage_stock,
                  vial_stock: m.vial_stock,
                  package_stock: m.package_stock,
                  package_volume: m.package_volume,
                  remain_package_fulfill: m.remain_package_fulfill,
                  volume_per_liter: m.volume_per_liter,
                  max_dosage: m.max_dosage,
                  recommend_order_base_on_max: m.recommend_order_base_on_max,
                  projection_stock: m.projection_stock,
                  projection_vial_stock: m.projection_vial_stock,
                  projection_package_stock: m.projection_package_stock,
                  projection_package_volume: m.projection_package_volume,
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
              // console.log(`key updatean: ${key}`)
              // console.log(`id updatean: ${m.id}`)
              await trx
                .updateTable("coldstorage_materials")
                .set({
                  dosage_stock: m.dosage_stock,
                  vial_stock: m.vial_stock,
                  package_stock: m.package_stock,
                  package_volume: m.package_volume,
                  remain_package_fulfill: m.remain_package_fulfill,
                  volume_per_liter: m.volume_per_liter,
                  max_dosage: m.max_dosage,
                  recommend_order_base_on_max: m.recommend_order_base_on_max,
                  projection_stock: m.projection_stock,
                  projection_vial_stock: m.projection_vial_stock,
                  projection_package_stock: m.projection_package_stock,
                  projection_package_volume: m.projection_package_volume,
                  created_at: m.created_at ? new Date(m.created_at) : now,
                  updated_at: m.updated_at ? new Date(m.updated_at) : now,
                  deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
                })
                .where("id", "=", Number(nameToV5Id.get(key)))
                .where("coldstorage_id", "=", m.platform_coldstorage_id)
                .where("material_id", "=", m.platform_material_id)
                .where("entity_id", "=", m.platform_entity_id)
                .execute()

              totalUpdate += 1
              coldstorageV5Ids.set(key, Number(nameToV5Id.get(key)))
            }
          } else {
            // skip, coldstorageid, entity id dan material id tidak boleh null atau coldstorage id, entity id dan material id 3.0 tidak ada di 5.0
            totalSkip += 1
            console.log(
              `Coldstorage materials ${m.id} cannot find coldstorage id ${m.coldstorage_id} or material id ${m.master_material_id} or entity_id ${m.entity_id} in 5.0 or coldstorage id or material id entity id is null`
            )
            continue
          }
        } catch (err) {
          totalFail += 1
          console.error("❌ Failed inserting coldstorage materials:", m.id, err)
        }
      }
    }) // end trx

    offset += limit
  } // end while

  // ========================
  // FINAL TRUNCATE STEP (hapus mlapping)
  // ========================
  if (truncate && targetPlatformIds.length > 0) {
    console.log(
      `🧹 Final truncate step: deleting mapping for ${targetPlatformIds} platform IDs`
    )
    await syncDB
      .deleteFrom("mapping_coldstorage_materials")
      .where("platform_coldstorage_material_id", "in", targetPlatformIds)
      .where("program_id", "=", programId)
      .execute()

    await resetIncrement(syncDB, "mapping_coldstorage_materials")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================
  for (const v3 of allColdstorageV3) {
    const key = makeKey(
      v3.platform_coldstorage_id,
      v3.platform_material_id,
      v3.platform_entity_id
    )
    const newV5Id = coldstorageV5Ids.get(key)
    if (!newV5Id) continue

    const exists = await syncDB
      .selectFrom("mapping_coldstorage_materials")
      .select("id")
      .where("program_id", "=", programId)
      .where("platform_coldstorage_material_id", "=", newV5Id)
      .where("existing_coldstorage_material_id", "=", v3.id)
      .executeTakeFirst()

    if (!exists) {
      await syncDB
        .insertInto("mapping_coldstorage_materials")
        .values({
          program_id: programId,
          platform_coldstorage_material_id: newV5Id,
          existing_coldstorage_material_id: v3.id,
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
