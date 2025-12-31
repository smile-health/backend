import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const now = new Date()

// mengambil data platform karena contract ada di program
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

export async function migrateContractV3ToV5(
  limit = CHUNK_SIZE,
  programId: number = 1,
  truncate: boolean = false
) {
  console.time("⏱️ Full migration start at")
  const migrationDb = getMigrationDB(programId)
  let offset = 0
  let total = 0
  const contractV5Ids = new Map<string, number>()

  // simpan hasil step truncate 2b
  let targetPlatformIds: number[] = []

  // simpan semua data v3
  const allContractsV3: any[] = []

  // ========================
  // TRUNCATE FLOW
  // ========================
  if (truncate) {
    console.log("🧹 Running truncate cleanup before migration...")

    try {
      // ambil semua mapping (program_id + platform_volume_material_id)
      const mappingsGrouped = await syncDB
        .selectFrom("mapping_contracts")
        .select(["program_id", "platform_contract_id"])
        .execute()

      if (mappingsGrouped.length > 0) {
        // group platform_contract_id -> set(program_id)
        const platformIdToPrograms = new Map<number, Set<number>>()
        for (const m of mappingsGrouped) {
          const set =
            platformIdToPrograms.get(m.platform_contract_id) ??
            new Set<number>()
          set.add(m.program_id)
          platformIdToPrograms.set(m.platform_contract_id, set)
        }

        // pilih platform IDs yang hanya ada pada programId
        targetPlatformIds = Array.from(platformIdToPrograms.entries())
          .filter(
            ([_, progSet]) => progSet.size === 1 && progSet.has(programId)
          )
          .map(([id]) => id)

        console.log(
          `🧹 Found ${targetPlatformIds.length} platform IDs unique to programId=${programId}`
        )

        if (targetPlatformIds.length > 0) {
          // delete ws_contracts
          await db
            .deleteFrom("ws_contracts")
            .where("id", "in", targetPlatformIds)
            .execute()

          // reset autoincrement untuk tabel yang dihapus
          await resetIncrement(db, "ws_contracts")
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
    const contractsV3: any = await migrationDb
      .selectFrom("contracts")
      .selectAll()
      .orderBy("id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (contractsV3.length === 0) break

    const commitmentsV3: any = await migrationDb
      .selectFrom("commitments")
      .select([
        "id",
        "contract_number",
        "created_by",
        "updated_by",
        "deleted_by",
        "created_at",
        "updated_at",
        "deleted_at",
      ])
      .orderBy("id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (commitmentsV3.length > 0) contractsV3.push(...commitmentsV3)

    // add platform user id to v3
    const enrichedContractsV3Raw = contractsV3.map(async (m: any) => ({
      ...m,
      platform_user_created_id: userSet.get(m.created_by) ?? null,
      platform_user_updated_id: userSet.get(m.updated_by) ?? null,
      platform_user_deleted_id: userSet.get(m.deleted_by) ?? null,
    }))

    // tambahkan hasil query batch ini ke list besar
    const enrichedContractsV3 = await Promise.all(enrichedContractsV3Raw)

    allContractsV3.push(...enrichedContractsV3)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      // --- 1) Sinkronisasi contracts ---
      const existingV5 = await trx
        .selectFrom("ws_contracts")
        .selectAll()
        .orderBy("id")
        .execute()

      const nameToV5Id = new Map<string, number>()
      for (const e of existingV5) {
        nameToV5Id.set(e.contract_number, e.id)
        contractV5Ids.set(e.contract_number, e.id)
      }

      // Insert baru jika belum ada
      for (const m of enrichedContractsV3) {
        if (!nameToV5Id.get(m.contract_number)) {
          try {
            const inserted = await trx
              .insertInto("ws_contracts")
              .values({
                contract_number: m.contract_number,
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

              nameToV5Id.set(m.contract_number, Number(inserted.insertId))

              contractV5Ids.set(m.contract_number, Number(inserted.insertId))
            }
          } catch (err) {
            console.error(
              "❌ Failed inserting contracts:",
              m.contract_number,
              err
            )
          }
        } else {
          contractV5Ids.set(
            m.contract_number,
            Number(nameToV5Id.get(m.contract_number))
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
      .deleteFrom("mapping_contracts")
      .where("platform_contract_id", "in", targetPlatformIds)
      .where("program_id", "=", programId)
      .execute()

    await resetIncrement(syncDB, "mapping_contracts")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================
  for (const v3 of allContractsV3) {
    const newV5Id = contractV5Ids.get(v3.contract_number)
    if (!newV5Id) continue

    const exists = await syncDB
      .selectFrom("mapping_contracts")
      .select("id")
      .where("program_id", "=", programId)
      .where("platform_contract_id", "=", newV5Id)
      .where("existing_contract_id", "=", v3.id)
      .executeTakeFirst()

    if (!exists) {
      await syncDB
        .insertInto("mapping_contracts")
        .values({
          program_id: programId,
          platform_contract_id: newV5Id,
          existing_contract_id: v3.id,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  console.timeEnd("⏱️ Full migration end at")
  console.log(`Total migrated rows processed: ${total}`)
}
