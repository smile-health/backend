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

async function mappingGlobalIds(fieldString, tableName, programId) {
  const mappingGlobals = await syncDB
    .selectFrom(tableName)
    .select(["program_id", `platform_global_id`, `existing_${fieldString}_id`])
    .where("program_id", "=", programId)
    .execute()

  const existingToGlobal = new Map<number, number>()
  for (const m of mappingGlobals) {
    existingToGlobal.set(
      m[`existing_${fieldString}_id`],
      m[`platform_global_id`]
    )
  }

  return existingToGlobal
}

export async function migrateCommitmentItemV3ToV5(
  limit = CHUNK_SIZE,
  programId: number = 1
) {
  console.time("⏱️ Full migration start at")
  const migrationDb = getMigrationDB(programId)
  let offset = 0
  let total = 0

  let targetPlatformIds: number[] = []

  // simpan semua data v3
  const allCommitmentItemsV3: any[] = []

  // ========================
  // TRUNCATE FLOW
  // ========================
  console.log("🧹 Running truncate cleanup before migration...")

  try {
    // 2a. ambil semua mapping (program_id + platform_commitment_item_id)
    const mappingsGrouped = await syncDB
      .selectFrom("mapping_commitment_items")
      .select(["program_id", "platform_commitment_item_id"])
      .execute()

    if (mappingsGrouped.length > 0) {
      // group platform_commitment_item_id -> set(program_id)
      const platformIdToPrograms = new Map<number, Set<number>>()
      for (const m of mappingsGrouped) {
        const set =
          platformIdToPrograms.get(m.platform_commitment_item_id) ??
          new Set<number>()
        set.add(m.program_id)
        platformIdToPrograms.set(m.platform_commitment_item_id, set)
      }

      targetPlatformIds = Array.from(platformIdToPrograms.entries())
        .filter(([_, progSet]) => progSet.size === 1 && progSet.has(programId))
        .map(([id]) => id)

      console.log(
        `🧹 Found ${targetPlatformIds.length} platform IDs unique to programId=${programId}`
      )

      if (targetPlatformIds.length > 0) {
        // 3. delete ws_commitment_items
        await db
          .deleteFrom("ws_commitment_items")
          .where("id", "in", targetPlatformIds)
          .execute()

        // 4. reset autoincrement untuk tabel yang dihapus
        await resetIncrement(db, "ws_commitment_items")
      }

      console.log("🧹 Truncate cleanup done, continue migration...")
    }
  } catch (err) {
    console.error("❌ Error during truncate cleanup:", err)
  }

  // ========================
  // PRE MAIN MIGRATION LOOP
  // ========================

  // proses mapping platform ke asset v3
  const userSet = await mappingIds("user", "mapping_users", programId)

  const materialPlatformSet = await mappingIds(
    "material",
    "mapping_materials",
    programId
  )

  const materialGlobalSet = await mappingGlobalIds(
    "material",
    "mapping_materials",
    programId
  )

  const commitmentSet = await mappingIds(
    "commitment",
    "mapping_commitments",
    programId
  )

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    const commitmentItemsV3 = await migrationDb
      .selectFrom("commitment_items")
      .selectAll()
      .orderBy("id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (commitmentItemsV3.length === 0) break

    // add platform commitment, material and user id to v3
    const enrichedCommitmentItemsV3Raw = commitmentItemsV3.map(async (m) => ({
      ...m,
      platform_commitment_id: commitmentSet.get(m.commitment_id),
      platform_material_id: materialPlatformSet.get(m.material_id),
      global_material_id: materialGlobalSet.get(m.material_id) ?? null,
      platform_province_id:
        m.province_id !== "00" ? Number(m.province_id) : null,
      platform_user_created_id: userSet.get(Number(m.created_by)) ?? null,
      platform_user_updated_id: userSet.get(Number(m.updated_by)) ?? null,
      platform_user_deleted_id: userSet.get(Number(m.deleted_by)) ?? null,
      platform_commitment_item_id: 0,
    }))

    // tambahkan hasil query batch ini ke list besar
    const enrichedCommitmentItemV3 = await Promise.all(
      enrichedCommitmentItemsV3Raw
    )

    allCommitmentItemsV3.push(...enrichedCommitmentItemV3)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      // Insert baru jika belum ada
      for (const m of enrichedCommitmentItemV3) {
        try {
          const inserted = await trx
            .insertInto("ws_commitment_items")
            .values({
              commitment_id: Number(m.platform_commitment_id),
              delivery_type_id: Number(m.service_type_id),
              material_id: Number(m.platform_material_id),
              parent_material_id: m.global_material_id,
              province_id: m.platform_province_id,
              vial_quantity: m.vial_quantity,
              dose_quantity: m.dose_quantity,
              created_at: m.created_at ? new Date(m.created_at) : now,
              created_by: m.platform_user_created_id,
              updated_at: m.updated_at ? new Date(m.updated_at) : now,
              updated_by: m.platform_user_updated_id,
              deleted_at: m.deleted_at ? new Date(m.deleted_at) : null,
              deleted_by: m.platform_user_deleted_id,
            })
            .executeTakeFirst()

          if (inserted) {
            total += 1

            m.platform_commitment_item_id = Number(inserted.insertId)
          }
        } catch (err) {
          console.error(
            "❌ Failed inserting ws_commitment_items:",
            m.platform_commitment_item_id,
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
  if (targetPlatformIds.length > 0) {
    console.log(
      `🧹 Final truncate step: deleting mapping for ${targetPlatformIds} platform IDs`
    )
    await syncDB
      .deleteFrom("mapping_commitment_items")
      .where("platform_commitment_item_id", "in", targetPlatformIds)
      .where("program_id", "=", programId)
      .execute()

    await resetIncrement(syncDB, "mapping_commitment_items")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================
  for (const v3 of allCommitmentItemsV3) {
    const exists = await syncDB
      .selectFrom("mapping_commitment_items")
      .select("id")
      .where("program_id", "=", programId)
      .where("platform_commitment_item_id", "=", v3.platform_commitment_item_id)
      .where("existing_commitment_item_id", "=", v3.id)
      .executeTakeFirst()

    if (!exists) {
      await syncDB
        .insertInto("mapping_commitment_items")
        .values({
          program_id: programId,
          platform_commitment_item_id: v3.platform_commitment_item_id,
          existing_commitment_item_id: v3.id,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  console.timeEnd("⏱️ Full migration end at")
  console.log(`Total migrated rows processed: ${total}`)
}
