import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration_iot_new.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

// disclaimer: kalau asset communication provider akan menjadi bagian dari asset vendor di 5.0
// disesuaikan dengan vendor tipenya yaitu: asset_vendor_type.label.communication_provider

const CHUNK_SIZE = 1000
const now = new Date()

function makeKey(name, asset_vendor_type_id) {
  return [name ?? null, asset_vendor_type_id ?? null].join("|")
}

// mengambil data platform global karena asset communication provider digabungkan dengan asset vendor sebagai data master
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

export async function migrateAssetCommunicationProviderV3ToV5(
  limit = CHUNK_SIZE,
  programId: number = 1,
  truncate: boolean = false
) {
  console.time("⏱️ Full migration start at")
  const migrationDb = getMigrationDB()
  let offset = 0
  let total = 0
  const providerV5Ids = new Map<string, number>()

  // simpan hasil step truncate 2b
  let targetPlatformIds: number[] = []

  // simpan semua data v3
  const allProvidersV3: any[] = []

  // simpan id vendor tipe khusus communication provider
  let providerVendorTypeId: number = 0

  // ========================
  // TRUNCATE FLOW
  // ========================
  if (truncate) {
    console.log("🧹 Running truncate cleanup before migration...")

    try {
      // 2a. ambil semua mapping (program_id + platform_communication_provider_id)
      const mappingsGrouped = await syncDB
        .selectFrom("mapping_communication_providers")
        .select(["program_id", "platform_communication_provider_id"])
        .execute()

      if (mappingsGrouped.length > 0) {
        // group platform_communication_provider_id -> set(program_id)
        const platformIdToPrograms = new Map<number, Set<number>>()
        for (const m of mappingsGrouped) {
          const set =
            platformIdToPrograms.get(m.platform_communication_provider_id) ??
            new Set<number>()
          set.add(m.program_id)
          platformIdToPrograms.set(m.platform_communication_provider_id, set)
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
          // 3. delete master table: asset vendors
          await db
            .deleteFrom("asset_vendors")
            .where("id", "in", targetPlatformIds)
            .execute()

          // 4. reset autoincrement untuk tabel yang dihapus
          await resetIncrement(db, "asset_vendors")
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

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    // cek id apa saja yang tersedia di asset vendor types platform
    const assetVendorType = await db
      .selectFrom("asset_vendor_types")
      .select(["id"])
      .where("name", "=", "asset_vendor_type.label.communication_provider")
      .orderBy("id")
      .executeTakeFirst()

    // asset vendor type id wajib ada
    if (!assetVendorType) break

    // assign nilai id vendor type khusus communication provider
    providerVendorTypeId = assetVendorType.id

    const providersV3 = await migrationDb
      .selectFrom("asset_communication_providers as acp")
      .select([
        "acp.id",
        "acp.name",
        "acp.description",
        "acp.created_by",
        "acp.updated_by",
        "acp.deleted_by",
        "acp.created_at",
        "acp.updated_at",
        "acp.deleted_at",
      ])
      .orderBy("acp.id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (providersV3.length === 0) break

    const enrichedProvidersV3Raw = providersV3.map(async (m) => ({
      ...m,
      platform_user_created_id: userSet.get(m.created_by) ?? null,
      platform_user_updated_id: userSet.get(m.updated_by) ?? null,
      platform_user_deleted_id: userSet.get(m.deleted_by) ?? null,
    }))

    const enrichedProvidersV3 = await Promise.all(enrichedProvidersV3Raw)

    // tambahkan hasil query batch ini ke list besar
    allProvidersV3.push(...enrichedProvidersV3)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      // --- 1) Sinkron asset vendors ---
      const existingV5 = await trx
        .selectFrom("asset_vendors")
        .select(["id", "name", "asset_vendor_type_id", "description"])
        .orderBy("id")
        .execute()

      const nameToV5Id = new Map<string, number>()
      for (const e of existingV5) {
        nameToV5Id.set(makeKey(e.name, e.asset_vendor_type_id), e.id)
        providerV5Ids.set(makeKey(e.name, e.asset_vendor_type_id), e.id)
      }

      // Insert baru jika belum ada
      for (const a of enrichedProvidersV3) {
        const key = makeKey(a.name, providerVendorTypeId)
        if (!nameToV5Id.get(key)) {
          try {
            const inserted = await trx
              .insertInto("asset_vendors")
              .values({
                name: a.name,
                asset_vendor_type_id: providerVendorTypeId,
                description: a.description,
                created_at: a.created_at ? new Date(a.created_at) : now,
                created_by: a.platform_user_created_id,
                updated_at: a.updated_at ? new Date(a.updated_at) : now,
                updated_by: a.platform_user_updated_id,
                deleted_at: a.deleted_at ? new Date(a.deleted_at) : null,
                deleted_by: a.platform_user_deleted_id,
              })
              .executeTakeFirst()

            if (inserted) {
              total += 1

              nameToV5Id.set(key, inserted.insertId)

              providerV5Ids.set(key, inserted.insertId)
            }
          } catch (err) {
            console.error("❌ Failed inserting asset_vendors:", key, err)
          }
        } else {
          providerV5Ids.set(key, nameToV5Id.get(key))
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
      .deleteFrom("mapping_communication_providers")
      .where("platform_communication_provider_id", "in", targetPlatformIds)
      .where("program_id", "=", programId)
      .execute()

    await resetIncrement(syncDB, "mapping_communication_providers")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================

  for (const v3 of allProvidersV3) {
    const key = makeKey(v3.name, providerVendorTypeId)
    const newV5Id = providerV5Ids.get(key)
    if (!newV5Id) continue

    // `platform_communication_provider_id` dianggap sebagai data global karena sebagai data master
    const exists = await syncDB
      .selectFrom("mapping_communication_providers")
      .select("id")
      .where("program_id", "=", programId)
      .where("platform_communication_provider_id", "=", newV5Id)
      .where("existing_communication_provider_id", "=", v3.id)
      .executeTakeFirst()

    if (!exists) {
      await syncDB
        .insertInto("mapping_communication_providers")
        .values({
          program_id: programId,
          platform_communication_provider_id: newV5Id,
          existing_communication_provider_id: v3.id,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  console.timeEnd("⏱️ Full migration end at")
  console.log(`Total migrated rows processed: ${total}`)
}
