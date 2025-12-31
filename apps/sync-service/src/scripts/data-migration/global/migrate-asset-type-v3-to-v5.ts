import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration_iot_new.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000

const PREDEFINED_THRESHOLDS = new Set(["2-8", "-25--15", "-86--40"])

function isPredefined(
  min: number | null | undefined,
  max: number | null | undefined
): 1 | 0 {
  if (min == null || max == null) return 0
  return PREDEFINED_THRESHOLDS.has(`${min}-${max}`) ? 1 : 0
}

function tempKey(
  min: number | null | undefined,
  max: number | null | undefined
) {
  if (min == null || max == null) return null
  return `${min}-${max}`
}

// mengambil data platform global karena asset type sebagai data master
async function mappingIds(fieldString, tableName, programId) {
  const mappingPlatforms = await syncDB
    .selectFrom(tableName)
    .select(["program_id", `platform_global_id`, `existing_${fieldString}_id`])
    .where("program_id", "=", programId)
    .execute()

  const existingToPlatform = new Map<number, number>()
  for (const m of mappingPlatforms) {
    existingToPlatform.set(
      m[`existing_${fieldString}_id`],
      m[`platform_global_id`]
    )
  }

  return existingToPlatform
}

const now = new Date()

export async function migrateAssetTypeV3ToV5(
  limit = CHUNK_SIZE,
  programId: number = 1,
  truncate: boolean = false
) {
  console.time("⏱️ Full migration start at")
  const migrationDb = getMigrationDB()
  let offset = 0
  let total = 0
  const assetV5Ids = new Map<string, number>()

  // simpan hasil step 2b
  let targetPlatformIds: number[] = []

  // simpan semua data v3
  const allAssetsV3: any[] = []

  // ========================
  // TRUNCATE FLOW
  // ========================
  if (truncate) {
    console.log("🧹 Running truncate cleanup before migration...")

    try {
      // 2a. ambil semua mapping (program_id + platform_asset_type_id)
      const mappingsGrouped = await syncDB
        .selectFrom("mapping_asset_types")
        .select(["program_id", "platform_asset_type_id"])
        .execute()

      if (mappingsGrouped.length > 0) {
        // group platform_asset_type_id -> set(program_id)
        const platformIdToPrograms = new Map<number, Set<number>>()
        for (const m of mappingsGrouped) {
          const set =
            platformIdToPrograms.get(m.platform_asset_type_id) ??
            new Set<number>()
          set.add(m.program_id)
          platformIdToPrograms.set(m.platform_asset_type_id, set)
        }

        // 2b. pilih platform IDs yang hanya ada pada programId
        targetPlatformIds = Array.from(platformIdToPrograms.entries())
          .filter(
            ([_, progSet]) => progSet.size === 1 && progSet.has(programId)
          )
          .map(([id]) => id)

        console.log(
          `🧹 Found ${targetPlatformIds.length} platform IDs unique to programId=${programId}`
        )

        if (targetPlatformIds.length > 0) {
          // 3. delete classifications
          await db
            .deleteFrom("asset_types_classifications")
            .where("asset_type_id", "in", targetPlatformIds)
            .execute()

          // 4. delete relations
          await db
            .deleteFrom("asset_types_temperatures")
            .where("asset_type_id", "in", targetPlatformIds)
            .execute()

          // 5. delete asset_types
          await db
            .deleteFrom("asset_types")
            .where("id", "in", targetPlatformIds)
            .execute()

          //6. reset id for all table deleted
          await resetIncrement(db, "asset_types_classifications")
          await resetIncrement(db, "asset_types_temperatures")
          await resetIncrement(db, "asset_types")
        }

        console.log(
          "🧹 Truncate cleanup done up to step 8, continue migration..."
        )
      }
    } catch (err) {
      console.error("❌ Error during truncate cleanup:", err)
    }
  }

  // ========================
  // PRE MAIN MIGRATION LOOP
  // ========================

  // proses mapping platform ke asset v3
  const userSet = await mappingIds("user", "mapping_users", programId)

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    const assetsV3 = await migrationDb
      .selectFrom("asset_type")
      .select([
        "asset_type.id",
        "asset_type.name",
        "asset_type.description",
        "asset_type.min_temp",
        "asset_type.max_temp",
        "asset_type.min_temp_2",
        "asset_type.max_temp_2",
        "asset_type.min_temp_3",
        "asset_type.max_temp_3",
        "asset_type.is_coldstorage",
        "asset_type.is_electricity",
        "asset_type.is_selection",
        "asset_type.created_by",
        "asset_type.updated_by",
        "asset_type.created_at",
        "asset_type.updated_at",
        "asset_type.deleted_at",
      ])
      .orderBy("asset_type.id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (assetsV3.length === 0) break

    const enrichedAssetsV3Raw = assetsV3.map(async (m) => ({
      ...m,
      platform_user_created_id: userSet.get(m.created_by) ?? null,
      platform_user_updated_id: userSet.get(m.updated_by) ?? null,
    }))

    // tambahkan hasil query batch ini ke list besar
    const enrichedAssetsV3 = await Promise.all(enrichedAssetsV3Raw)

    // tambahkan hasil query batch ini ke list besar
    allAssetsV3.push(...enrichedAssetsV3)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      // --- 1) Sinkron asset_types ---
      const names = enrichedAssetsV3
        .map((r) => r.name ?? null)
        .filter((n): n is string => n !== null)

      const existingV5 = await trx
        .selectFrom("asset_types")
        .select(["id", "name"])
        .where("name", "in", names)
        .orderBy("id")
        .execute()

      const nameToV5Id = new Map<string, number>()
      for (const e of existingV5) {
        nameToV5Id.set(e.name, e.id)
        assetV5Ids.set(e.name, e.id)
      }

      for (const a of enrichedAssetsV3) {
        if (!nameToV5Id.has(a.name)) {
          try {
            const inserted = await trx
              .insertInto("asset_types")
              .values({
                name: a.name,
                description: a.description ?? null,
                created_at: a.created_at ? new Date(a.created_at) : now,
                created_by: a.platform_user_created_id,
                updated_at: a.updated_at ? new Date(a.updated_at) : now,
                updated_by: a.platform_user_updated_id,
                deleted_at: a.deleted_at ? new Date(a.deleted_at) : null,
              })
              .executeTakeFirst()

            if (inserted) {
              total += 1

              nameToV5Id.set(a.name, inserted.insertId)
              assetV5Ids.set(a.name, inserted.insertId)
            }
          } catch (err) {
            console.error("❌ Failed inserting asset_type:", a.name, err)
          }
        } else {
          assetV5Ids.set(a.name, nameToV5Id.get(a.name))
        }
      }

      // --- 2) asset_types_classifications ---
      for (const a of enrichedAssetsV3) {
        const v5Id = nameToV5Id.get(a.name)
        if (!v5Id) continue

        // Cek is_coldstorage → classification_id = 1 atau 2
        if (a.is_coldstorage !== null && a.is_coldstorage !== undefined) {
          const classificationId = a.is_coldstorage === 1 ? 1 : 2

          const exists = await trx
            .selectFrom("asset_types_classifications")
            .select("id")
            .where("asset_type_id", "=", v5Id)
            .where("asset_classifications_id", "=", classificationId)
            .executeTakeFirst()

          if (!exists) {
            await trx
              .insertInto("asset_types_classifications")
              .values({
                asset_type_id: v5Id,
                asset_classifications_id: classificationId,
                created_at: a.created_at ? new Date(a.created_at) : now,
                created_by: a.platform_user_created_id,
                updated_at: a.updated_at ? new Date(a.updated_at) : now,
                updated_by: a.platform_user_updated_id,
                deleted_at: a.deleted_at ? new Date(a.deleted_at) : null,
              })
              .execute()
          }
        }

        // Cek is_electricity → classification_id = 3 (hanya kalau 1)
        if (a.is_electricity === 1) {
          const exists = await trx
            .selectFrom("asset_types_classifications")
            .select("id")
            .where("asset_type_id", "=", v5Id)
            .where("asset_classifications_id", "=", 3)
            .executeTakeFirst()

          if (!exists) {
            await trx
              .insertInto("asset_types_classifications")
              .values({
                asset_type_id: v5Id,
                asset_classifications_id: 3,
                created_at: a.created_at ? new Date(a.created_at) : now,
                created_by: a.platform_user_created_id,
                updated_at: a.updated_at ? new Date(a.updated_at) : now,
                updated_by: a.platform_user_updated_id,
                deleted_at: a.deleted_at ? new Date(a.deleted_at) : null,
              })
              .execute()
          }
        }

        // Cek is_selection → classification_id = 4 (hanya kalau 1)
        if (a.is_selection === 1) {
          const exists = await trx
            .selectFrom("asset_types_classifications")
            .select("id")
            .where("asset_type_id", "=", v5Id)
            .where("asset_classifications_id", "=", 4)
            .executeTakeFirst()

          if (!exists) {
            await trx
              .insertInto("asset_types_classifications")
              .values({
                asset_type_id: v5Id,
                asset_classifications_id: 4,
                created_at: a.created_at ? new Date(a.created_at) : now,
                created_by: a.platform_user_created_id,
                updated_at: a.updated_at ? new Date(a.updated_at) : now,
                updated_by: a.platform_user_updated_id,
                deleted_at: a.deleted_at ? new Date(a.deleted_at) : null,
              })
              .execute()
          }
        }
      }

      // --- 3 & 4) thresholds + relations ---
      for (const a of enrichedAssetsV3) {
        const v5Id = nameToV5Id.get(a.name)
        if (!v5Id) continue

        const ranges = [
          [a.min_temp, a.max_temp],
          [a.min_temp_2, a.max_temp_2],
          [a.min_temp_3, a.max_temp_3],
        ]

        for (const [min, max] of ranges) {
          if (min == null || max == null) continue

          const key = tempKey(min, max)
          if (!key) continue

          let thresholdId
          const existingThreshold = await trx
            .selectFrom("temperature_thresholds")
            .select(["id"])
            .where("min_temperature", "=", min)
            .where("max_temperature", "=", max)
            .executeTakeFirst()

          if (existingThreshold) {
            thresholdId = existingThreshold.id
          } else {
            const inserted = await trx
              .insertInto("temperature_thresholds")
              .values({
                min_temperature: min,
                max_temperature: max,
                is_predefined: isPredefined(min, max),
                created_at: now,
                updated_at: now,
              })
              // .returning("id")
              .executeTakeFirst()
            if (inserted) thresholdId = inserted.insertId
          }

          //patching disini lgs id suhu yang baru diinsert
          if (thresholdId) {
            const relExists = await trx
              .selectFrom("asset_types_temperatures")
              .select("asset_type_id")
              .where("asset_type_id", "=", v5Id)
              .where("temperature_threshold_id", "=", thresholdId)
              .executeTakeFirst()

            if (!relExists) {
              await trx
                .insertInto("asset_types_temperatures")
                .values({
                  asset_type_id: v5Id,
                  temperature_threshold_id: thresholdId,
                  created_at: a.created_at ? new Date(a.created_at) : now,
                  created_by: a.platform_user_created_id,
                  updated_at: a.updated_at ? new Date(a.updated_at) : now,
                  updated_by: a.platform_user_updated_id,
                  deleted_at: a.deleted_at ? new Date(a.deleted_at) : null,
                })
                .execute()
            }
          }
        }
      }
    }) // end trx

    offset += limit
  } // end while

  if (truncate && targetPlatformIds.length > 0) {
    console.log(
      `🧹 Final truncate step: deleting mapping for ${targetPlatformIds} platform IDs`
    )
    await syncDB
      .deleteFrom("mapping_asset_types")
      .where("platform_asset_type_id", "in", targetPlatformIds)
      .where("program_id", "=", programId)
      .execute()

    await resetIncrement(syncDB, "mapping_asset_types")
  }

  for (const aV3 of allAssetsV3) {
    const newV5Id = assetV5Ids.get(aV3.name)
    if (!newV5Id) continue

    // `platform_asset_type_id` dianggap sebagai data global karena sebagai data master
    const exists = await syncDB
      .selectFrom("mapping_asset_types")
      .select("id")
      .where("program_id", "=", programId)
      .where("platform_asset_type_id", "=", newV5Id)
      .where("existing_asset_type_id", "=", aV3.id)
      .executeTakeFirst()

    if (!exists) {
      await syncDB
        .insertInto("mapping_asset_types")
        .values({
          program_id: programId,
          platform_asset_type_id: newV5Id,
          existing_asset_type_id: aV3.id,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  console.timeEnd("⏱️ Full migration end at")
  console.log(`Total migrated rows processed: ${total}`)
}
