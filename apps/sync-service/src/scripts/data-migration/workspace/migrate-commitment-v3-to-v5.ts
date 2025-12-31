import { db as syncDB } from "@/common/infrastructure/database/index.js"
import { Transaction } from "kysely"
import { getMigrationDB } from "../../db.migration.js"
import { db } from "../../db.platform.js"
import { resetIncrement } from "../../helper.js"
import { DB } from "../../types.platform.js"

const CHUNK_SIZE = 1000
const now = new Date()

function makeKey(contract_id, programId) {
  return [contract_id, programId].join("|")
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

async function contractV3Ids(programId) {
  const contractV3 = await getMigrationDB(programId)
    .selectFrom("contracts")
    .select(["id", "contract_number"])
    .execute()

  const setContracts = new Map<string, number>()
  for (const m of contractV3) {
    setContracts.set(m.contract_number, m.id)
  }

  return setContracts
}

async function commitmentV3Ids(programId) {
  const commitmentV3 = await getMigrationDB(programId)
    .selectFrom("commitments")
    .select(["id", "contract_number"])
    .execute()

  const setCommitments = new Map<string, number>()
  for (const m of commitmentV3) {
    setCommitments.set(m.contract_number, m.id)
  }

  return setCommitments
}

export async function migrateCommitmentV3ToV5(
  limit = CHUNK_SIZE,
  programId: number = 1,
  truncate: boolean = false
) {
  console.time("⏱️ Full migration start at")
  const migrationDb = getMigrationDB(programId)
  let offset = 0
  let total = 0
  const commitmentV5Ids = new Map<string, number>()

  let targetPlatformIds: number[] = []

  // simpan semua data v3
  const allCommitmentsV3: any[] = []

  // ========================
  // TRUNCATE FLOW
  // ========================
  if (truncate) {
    console.log("🧹 Running truncate cleanup before migration...")

    try {
      // 2a. ambil semua mapping (program_id + platform_volume_material_id)
      const mappingsGrouped = await syncDB
        .selectFrom("mapping_commitments")
        .select(["program_id", "platform_commitment_id"])
        .execute()

      if (mappingsGrouped.length > 0) {
        // group platform_commitment_id -> set(program_id)
        const platformIdToPrograms = new Map<number, Set<number>>()
        for (const m of mappingsGrouped) {
          const set =
            platformIdToPrograms.get(m.platform_commitment_id) ??
            new Set<number>()
          set.add(m.program_id)
          platformIdToPrograms.set(m.platform_commitment_id, set)
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
          // 3. delete ws_commitments
          await db
            .deleteFrom("ws_commitments")
            .where("id", "in", targetPlatformIds)
            .execute()

          // 4. reset autoincrement untuk tabel yang dihapus
          await resetIncrement(db, "ws_commitments")
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

  const baseContractSet = await contractV3Ids(programId)

  const baseCommitmentSet = await commitmentV3Ids(programId)

  const contractNumberSet = await mappingIds(
    "contract",
    "mapping_contracts",
    programId
  )

  const entitySet = await mappingIds("entity", "mapping_entities", programId)

  // ========================
  // MAIN MIGRATION LOOP
  // ========================
  while (true) {
    const commitmentsV3 = await migrationDb
      .selectFrom("commitments")
      .selectAll()
      .orderBy("id")
      .limit(limit)
      .offset(offset)
      .execute()

    if (commitmentsV3.length === 0) break

    // add platform contract, entity and user id to v3
    const enrichedCommitmentsV3Raw = commitmentsV3.map(async (m) => ({
      ...m,
      platform_contract_id: baseContractSet.get(m.contract_number)
        ? contractNumberSet.get(Number(baseContractSet.get(m.contract_number)))
        : contractNumberSet.get(
            Number(baseCommitmentSet.get(m.contract_number))
          ),
      platform_entity_id: entitySet.get(m.vendor_id),
      platform_user_created_id: userSet.get(Number(m.created_by)) ?? null,
      platform_user_updated_id: userSet.get(Number(m.updated_by)) ?? null,
      platform_user_deleted_id: userSet.get(Number(m.deleted_by)) ?? null,
    }))

    // tambahkan hasil query batch ini ke list besar
    const enrichedCommitmentV3 = await Promise.all(enrichedCommitmentsV3Raw)

    allCommitmentsV3.push(...enrichedCommitmentV3)

    await db.transaction().execute(async (trx: Transaction<DB>) => {
      // --- 1) Sinkronisasi commitments ---
      const existingV5 = await trx
        .selectFrom("ws_commitments")
        .selectAll()
        .orderBy("id")
        .execute()

      const nameToV5Id = new Map<string, number>()
      for (const e of existingV5) {
        nameToV5Id.set(makeKey(e.contract_id, programId), e.id)
        commitmentV5Ids.set(makeKey(e.contract_id, programId), e.id)
      }

      // Insert baru jika belum ada
      for (const m of enrichedCommitmentV3) {
        const key = makeKey(m.platform_contract_id, programId)
        if (!nameToV5Id.get(key)) {
          try {
            const inserted = await trx
              .insertInto("ws_commitments")
              .values({
                program_id: programId,
                contract_id: Number(m.platform_contract_id),
                vendor_id: Number(m.platform_entity_id),
                year: Number(m.year),
                contract_start_date: new Date(m.contract_date),
                contract_end_date: m.contract_end_date
                  ? new Date(m.contract_end_date)
                  : null,
                information: m.information,
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

              nameToV5Id.set(key, Number(inserted.insertId))

              commitmentV5Ids.set(key, Number(inserted.insertId))
            }
          } catch (err) {
            console.error("❌ Failed inserting ws_commitments:", key, err)
          }
        } else {
          commitmentV5Ids.set(key, Number(nameToV5Id.get(key)))
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
      .deleteFrom("mapping_commitments")
      .where("platform_commitment_id", "in", targetPlatformIds)
      .where("program_id", "=", programId)
      .execute()

    await resetIncrement(syncDB, "mapping_commitments")
  }

  // ========================
  // FINAL MAPPING SINKRONISASI
  // ========================
  for (const v3 of allCommitmentsV3) {
    const key = makeKey(v3.platform_contract_id, programId)
    const newV5Id = commitmentV5Ids.get(key)
    if (!newV5Id) continue

    const exists = await syncDB
      .selectFrom("mapping_commitments")
      .select("id")
      .where("program_id", "=", programId)
      .where("platform_commitment_id", "=", newV5Id)
      .where("existing_commitment_id", "=", v3.id)
      .executeTakeFirst()

    if (!exists) {
      await syncDB
        .insertInto("mapping_commitments")
        .values({
          program_id: programId,
          platform_commitment_id: newV5Id,
          existing_commitment_id: v3.id,
          created_at: now,
          updated_at: now,
        })
        .execute()
    }
  }

  console.timeEnd("⏱️ Full migration end at")
  console.log(`Total migrated rows processed: ${total}`)
}
