import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const now = new Date()

function makeKey(
  material_id,
  manufacture_id,
  unit_per_box,
  box_length,
  box_width,
  box_height
) {
  return [
    material_id ?? null,
    manufacture_id ?? null,
    unit_per_box ?? null,
    box_length ?? null,
    box_width ?? null,
    box_height ?? null,
  ].join("|")
}

// mengambil data platform global karena volume material sebagai data master
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

export async function migrateMaterialVolumeV3ToV5(
  limit = CHUNK_SIZE,
  programId: number = 1,
  truncate: boolean = false
) {
  console.time("⏱️ Full migration start at")
  const migrationDb = getMigrationDB()
  let offset = 0
  let total = 0
  const volumeV5Ids = new Map<string, number>()

  // simpan hasil step truncate 2b
  let targetPlatformIds: number[] = []

  // simpan semua data v3
  const allMaterialsV3: any[] = []

  // ========================
  // TRUNCATE FLOW
  // ========================
  if (truncate) {
    console.log("🧹 Running truncate cleanup before migration...")

    try {
      // 2a. ambil semua mapping (program_id + platform_volume_material_id)
      const mappingsGrouped = await syncDB
        .selectFrom("mapping_volume_material")
        .select(["program_id", "platform_volume_material_id"])
        .execute()

      if (mappingsGrouped.length > 0) {
        // group platform_volume_material_id -> set(program_id)
        const platformIdToPrograms = new Map<number, Set<number>>()
        for (const m of mappingsGrouped) {
          const set =
            platformIdToPrograms.get(m.platform_volume_material_id) ??
            new Set<number>()
          set.add(m.program_id)
          platformIdToPrograms.set(m.platform_volume_material_id, set)
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
          // 3. delete master table: volume_materials
          await db
            .deleteFrom("material_volumes")
            .where("id", "in", targetPlatformIds)
            .execute()

          // 4. reset autoincrement untuk tabel yang dihapus
          await resetIncrement(db, "material_volumes")
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

  // proses mapping platform ke asset v3
  const userSet = await mappingIds("user", "mapping_users", programId)

  const materialSet = await mappingIds(
    "material",
    "mapping_materials",
    programId
  )

  const manufactureSet = await mappingIds(
    "manufacture",
    "mapping_manufactures",
    programId
  )

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    const materialsV3 = await migrationDb
      .selectFrom("master_volume_material_manufactures as mvmm")
      .select([
        "mvmm.id",
        "mvmm.master_material_id",
        "mvmm.manufacture_id",
        "mvmm.unit_per_box",
        "mvmm.box_length",
        "mvmm.box_width",
        "mvmm.box_height",
        "mvmm.created_by",
        "mvmm.updated_by",
        "mvmm.created_at",
        "mvmm.updated_at",
        "mvmm.deleted_at",
      ])
      .orderBy("mvmm.id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (materialsV3.length === 0) break

    // add platform material and manufacture id to v3
    const enrichedMaterialsV3Raw = materialsV3.map(async (m) => ({
      ...m,
      platform_material_id: materialSet.get(m.master_material_id) ?? null,
      platform_manufacture_id: manufactureSet.get(m.manufacture_id) ?? null,
      platform_user_created_id: userSet.get(m.created_by) ?? null,
      platform_user_updated_id: userSet.get(m.updated_by) ?? null,
    }))

    // tambahkan hasil query batch ini ke list besar
    const enrichedMaterialsV3 = await Promise.all(enrichedMaterialsV3Raw)

    allMaterialsV3.push(...enrichedMaterialsV3)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      // --- 1) Sinkron volume_materials ---
      const existingV5 = await trx
        .selectFrom("material_volumes")
        .select([
          "id",
          "material_id",
          "manufacture_id",
          "unit_per_box",
          "box_length",
          "box_width",
          "box_height",
        ])
        .orderBy("id")
        .execute()

      const nameToV5Id = new Map<string, number>()
      for (const e of existingV5) {
        nameToV5Id.set(
          makeKey(
            e.material_id,
            e.manufacture_id,
            e.unit_per_box,
            e.box_length,
            e.box_width,
            e.box_height
          ),
          e.id
        )
        volumeV5Ids.set(
          makeKey(
            e.material_id,
            e.manufacture_id,
            e.unit_per_box,
            e.box_length,
            e.box_width,
            e.box_height
          ),
          e.id
        )
      }

      // Insert baru jika belum ada
      for (const m of enrichedMaterialsV3) {
        const key = makeKey(
          m.platform_material_id,
          m.platform_manufacture_id,
          m.unit_per_box,
          m.box_length,
          m.box_width,
          m.box_height
        )
        if (
          !nameToV5Id.get(key) &&
          m.platform_material_id !== null &&
          m.platform_manufacture_id !== null
        ) {
          try {
            const inserted = await trx
              .insertInto("material_volumes")
              .values({
                material_id: m.platform_material_id,
                manufacture_id: m.platform_manufacture_id,
                unit_per_box: m.unit_per_box ?? 0,
                box_length: m.box_length ?? 0,
                box_width: m.box_width ?? 0,
                box_height: m.box_height ?? 0,
                created_at: m.created_at ? new Date(m.created_at) : now,
                created_by: m.platform_user_created_id,
                updated_at: m.updated_at ? new Date(m.updated_at) : now,
                updated_by: m.platform_user_updated_id,
                deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
              })
              .executeTakeFirst()

            if (inserted) {
              total += 1

              nameToV5Id.set(key, inserted.insertId)

              volumeV5Ids.set(key, inserted.insertId)
            }
          } catch (err) {
            console.error("❌ Failed inserting material_volumes:", key, err)
          }
        } else {
          volumeV5Ids.set(key, nameToV5Id.get(key))
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
      .deleteFrom("mapping_volume_material")
      .where("platform_volume_material_id", "in", targetPlatformIds)
      .where("program_id", "=", programId)
      .execute()

    await resetIncrement(syncDB, "mapping_volume_material")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================

  for (const v3 of allMaterialsV3) {
    const key = makeKey(
      v3.platform_material_id,
      v3.platform_manufacture_id,
      v3.unit_per_box,
      v3.box_length,
      v3.box_width,
      v3.box_height
    )
    const newV5Id = volumeV5Ids.get(key)
    if (!newV5Id) continue

    // `platform_volume_material_id` dianggap sebagai data global karena sebagai data master
    const exists = await syncDB
      .selectFrom("mapping_volume_material")
      .select("id")
      .where("program_id", "=", programId)
      .where("platform_volume_material_id", "=", newV5Id)
      .where("existing_volume_material_id", "=", v3.id)
      .executeTakeFirst()

    if (!exists) {
      await syncDB
        .insertInto("mapping_volume_material")
        .values({
          program_id: programId,
          platform_volume_material_id: newV5Id,
          existing_volume_material_id: v3.id,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  console.timeEnd("⏱️ Full migration end at")
  console.log(`Total migrated rows processed: ${total}`)
}
